import crypto from 'node:crypto';

// INST-04 — Fundação do webhook Instagram.
// Esta rota só valida autenticidade e formato do evento. Ela não chama o
// agente/Gemini, não persiste nada e não responde ao cliente final.
// Persistência + idempotência real (INST-05) usarão dedupeKeyForEntry()
// abaixo para deduplicar por entry antes de qualquer processamento.
//
// INST-04A: usa o formato Web Request/Response (export GET/POST) em vez do
// formato Node (req,res). Isso elimina a incerteza sobre a camada de
// helpers automáticos da Vercel (request.query/.cookies/.body) — no modo
// Web Request essa camada simplesmente não existe, então o corpo chega
// sempre como bytes brutos, sem depender de nenhuma config para "desativar"
// um parsing automático. Ver docs/INSTAGRAM-WEBHOOK-FOUNDATION.md.

const VERIFY_TOKEN = process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN || '';
const APP_SECRET = process.env.INSTAGRAM_APP_SECRET || '';
const MAX_BODY_BYTES = 1024 * 1024; // Meta envia payloads pequenos; protege contra abuso.

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

function text(status, body) {
  return new Response(String(body), {
    status,
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
  });
}

// Lê o corpo em bytes brutos, em streaming, cortando cedo se ultrapassar o
// limite — mesmo comportamento do IncomingMessage.for-await de antes, só
// que sobre o ReadableStream padrão de request.body.
async function readRawBody(request) {
  if (!request.body) return Buffer.alloc(0);
  const chunks = [];
  let size = 0;
  for await (const chunk of request.body) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new Error('PAYLOAD_TOO_LARGE');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

// Comparação em tempo constante para strings de tamanho arbitrário (evita
// vazar tamanho/conteúdo por timing, mesmo quando os tamanhos diferem).
function timingSafeEqualStr(a, b) {
  const bufA = Buffer.from(String(a ?? ''), 'utf8');
  const bufB = Buffer.from(String(b ?? ''), 'utf8');
  if (bufA.length !== bufB.length) {
    // Ainda assim executa uma comparação de tempo constante para não vazar
    // a diferença de tamanho por atalho de curto-circuito.
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

function verifySignature(rawBody, header) {
  if (!APP_SECRET) return false;
  const h = String(header || '');
  if (!h.startsWith('sha256=')) return false;
  const received = h.slice('sha256='.length).trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(received)) return false;
  const expected = crypto.createHmac('sha256', APP_SECRET).update(rawBody).digest('hex');
  return timingSafeEqualStr(received, expected);
}

// Aceita somente o formato de evento Instagram esperado (Direct/comentários).
// Qualquer outro `object` (ex.: `page`, `whatsapp_business_account`) é
// rejeitado aqui, mesmo que a assinatura seja válida.
function isValidInstagramPayload(payload) {
  if (!payload || typeof payload !== 'object') return false;
  if (payload.object !== 'instagram') return false;
  if (!Array.isArray(payload.entry) || payload.entry.length === 0) return false;
  return payload.entry.every(
    (entry) => entry && typeof entry === 'object' && typeof entry.id === 'string' && entry.id.length > 0
  );
}

// Chave determinística por entrada do webhook. INST-05 usará esta chave para
// persistir e deduplicar eventos (ex.: unique constraint em banco). Aqui ela
// só é calculada e exportada para teste — nada é gravado nesta tarefa.
export function dedupeKeyForEntry(entry) {
  const stable = JSON.stringify({
    id: entry?.id ?? null,
    time: entry?.time ?? null,
    changes: entry?.changes ?? null,
    messaging: entry?.messaging ?? null,
  });
  return crypto.createHash('sha256').update(stable).digest('hex');
}

// Nunca logar o payload bruto: pode conter texto de mensagens/comentários de
// clientes finais. Só metadados seguros para observabilidade.
function safeLogMeta(payload) {
  return { object: payload?.object, entries: Array.isArray(payload?.entry) ? payload.entry.length : 0 };
}

export async function GET(request) {
  if (!VERIFY_TOKEN) return json(503, { error: 'Webhook do Instagram não configurado.' });
  const url = new URL(request.url);
  const mode = url.searchParams.get('hub.mode') || '';
  const token = url.searchParams.get('hub.verify_token') || '';
  const challenge = url.searchParams.get('hub.challenge');
  if (mode !== 'subscribe' || challenge === null || !timingSafeEqualStr(token, VERIFY_TOKEN)) {
    return json(403, { error: 'Verificação do webhook recusada.' });
  }
  return text(200, challenge);
}

export async function POST(request) {
  if (!APP_SECRET) return json(503, { error: 'Webhook do Instagram não configurado.' });

  let rawBody;
  try {
    rawBody = await readRawBody(request);
  } catch (error) {
    if (error?.message === 'PAYLOAD_TOO_LARGE') return json(413, { error: 'Payload muito grande.' });
    console.error('Instagram webhook: falha ao ler o corpo da requisição.');
    return json(400, { error: 'Não foi possível ler a requisição.' });
  }

  const signature = request.headers.get('x-hub-signature-256');
  if (!verifySignature(rawBody, signature)) {
    return json(401, { error: 'Assinatura inválida.' });
  }

  let payload;
  try {
    payload = JSON.parse(rawBody.toString('utf8'));
  } catch {
    return json(400, { error: 'Payload JSON inválido.' });
  }

  if (!isValidInstagramPayload(payload)) {
    // Autenticado, mas fora do escopo aceito nesta fundação. 200 evita que a
    // Meta entre em loop de retentativas para um evento que nunca vamos processar.
    return json(200, { ok: true, ignored: true });
  }

  console.log('Instagram webhook: evento recebido.', safeLogMeta(payload));

  // Fundação apenas: nenhuma chamada ao agente/Gemini, nenhuma persistência e
  // nenhuma resposta ao cliente final acontece aqui (INST-05 em diante).
  return json(200, { ok: true, accepted: true, entries: payload.entry.length });
}
