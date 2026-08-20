// VENCIVO / INST-08D — Orquestração de idempotência: persiste o evento
// ANTES de qualquer chamada ao Gemini, usando a UNIQUE(provider_event_id)
// real do Postgres (instagram_webhook_events, INST-05B/07) como garantia
// — não uma checagem em memória/JavaScript.
//
// NÃO é um endpoint (fica fora de api/, mesmo motivo do INST-08A/08B).
// NÃO é chamada por nada em produção ainda — quem dispara isso (o
// webhook de forma assíncrona, ou outro mecanismo) é decisão de uma
// tarefa futura, para não criar o "worker definitivo" vedado nesta.
//
// NUNCA chama a Send API do Instagram/Meta. NUNCA implementa
// response_status. Só Direct de texto (áudio fora de escopo).

import { dedupeKeyForEntry } from '../api/instagram-webhook.js';
import { processInstagramMessage } from './instagram-process-event.js';

const SUPABASE_URL = 'https://uxmlmyhiagjefuufanyg.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function classifyEntry(entry) {
  if (Array.isArray(entry?.messaging) && entry.messaging.length > 0) {
    return { event_type: 'messaging', item_types: ['message'], item_count: entry.messaging.length };
  }
  if (Array.isArray(entry?.changes) && entry.changes.length > 0) {
    return { event_type: 'comments', item_types: ['comment'], item_count: entry.changes.length };
  }
  return { event_type: 'unknown', item_types: [], item_count: 0 };
}

function extractDirectText(entry) {
  const first = entry?.messaging?.[0];
  const text = first?.message?.text;
  return typeof text === 'string' && text.trim() ? text : null;
}

/**
 * Tenta inserir o evento em instagram_webhook_events. Mesmo mecanismo já
 * usado por api/webhooks/asaas.js para billing_events: Prefer:
 * resolution=ignore-duplicates,return=representation. Se a
 * UNIQUE(provider_event_id) barrar o insert (evento já existe), o
 * PostgREST devolve um array VAZIO em vez de erro — é o Postgres, não
 * JavaScript, decidindo isso.
 */
async function insertEventIfNew(entry) {
  if (!SERVICE_ROLE_KEY) throw new Error('Supabase não configurado no servidor.');

  const providerEventId = dedupeKeyForEntry(entry);
  const { event_type, item_types, item_count } = classifyEntry(entry);
  const body = {
    provider_event_id: providerEventId,
    instagram_user_id: String(entry.id),
    event_type,
    payload: { entry_id: String(entry.id), time: entry?.time ?? null, item_count, item_types },
  };

  const r = await fetch(`${SUPABASE_URL}/rest/v1/instagram_webhook_events`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=ignore-duplicates,return=representation',
    },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error('Falha ao persistir o evento do Instagram.');
  const rows = await r.json().catch(() => null);

  return { isNew: Array.isArray(rows) && rows.length > 0, providerEventId };
}

/**
 * Reivindica (INSERT idempotente) e, só se for realmente novo, processa
 * um entry de webhook do Instagram. Gemini nunca é chamado antes da
 * confirmação de que o evento foi inserido.
 *
 * @param {object} entry - a mesma forma de entry já validada por
 *   api/instagram-webhook.js (precisa ter `id`; `messaging`/`changes`
 *   opcionais).
 */
export async function claimAndProcessInstagramEntry(entry) {
  if (!entry || typeof entry !== 'object' || typeof entry.id !== 'string' || !entry.id) {
    return { ok: false, reason: 'invalid_entry' };
  }

  let claim;
  try {
    claim = await insertEventIfNew(entry);
  } catch (e) {
    console.error('instagram-webhook-orchestrator: falha ao persistir evento.', e?.message);
    return { ok: false, reason: 'persistence_error' };
  }

  if (!claim.isNew) {
    return { ok: false, reason: 'duplicate_event', providerEventId: claim.providerEventId };
  }

  const message = extractDirectText(entry);
  if (!message) {
    // Já persistido (deduplicado corretamente) — só não há texto de
    // Direct para processar (comentário, áudio, etc. — fora de escopo).
    return { ok: false, reason: 'unsupported_entry_type', persisted: true, providerEventId: claim.providerEventId };
  }

  const result = await processInstagramMessage({ instagramUserId: entry.id, message });
  return { ...result, persisted: true, providerEventId: claim.providerEventId };
}
