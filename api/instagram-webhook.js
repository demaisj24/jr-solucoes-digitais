import crypto from 'node:crypto';

// INST-04 — Fundação do webhook Instagram.
// Esta rota só valida autenticidade e formato do evento. Ela não chama o
// agente/Gemini, não persiste nada e não responde ao cliente final.
// Persistência + idempotência real (INST-05) usarão dedupeKeyForEntry()
// abaixo para deduplicar por entry antes de qualquer processamento.

export const config = { api: { bodyParser: false } };

const VERIFY_TOKEN = process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN || '';
const APP_SECRET = process.env.INSTAGRAM_APP_SECRET || '';
const MAX_BODY_BYTES = 1024 * 1024; // Meta envia payloads pequenos; protege contra abuso.

function send(res, status, body, type = 'application/json') {
  res.statusCode = status;
  res.setHeader('Content-Type', `${type}; charset=utf-8`);
  res.setHeader('Cache-Control', 'no-store');
  return res.end(type === 'text/plain' ? String(body) : JSON.stringify(body));
}

async function readRawBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
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

export default async function handler(req, res) {
  if (req.method === 'GET') {
    if (!VERIFY_TOKEN) return send(res, 503, { error: 'Webhook do Instagram não configurado.' });
    const query = req.query || {};
    const mode = String(query['hub.mode'] || '');
    const token = String(query['hub.verify_token'] || '');
    const challenge = query['hub.challenge'];
    if (mode !== 'subscribe' || challenge === undefined || challenge === null || !timingSafeEqualStr(token, VERIFY_TOKEN)) {
      return send(res, 403, { error: 'Verificação do webhook recusada.' });
    }
    return send(res, 200, String(challenge), 'text/plain');
  }

  if (req.method !== 'POST') return send(res, 405, { error: 'Método não permitido.' });
  if (!APP_SECRET) return send(res, 503, { error: 'Webhook do Instagram não configurado.' });

  let rawBody;
  try {
    rawBody = await readRawBody(req);
  } catch (error) {
    if (error?.message === 'PAYLOAD_TOO_LARGE') return send(res, 413, { error: 'Payload muito grande.' });
    console.error('Instagram webhook: falha ao ler o corpo da requisição.');
    return send(res, 400, { error: 'Não foi possível ler a requisição.' });
  }

  const signatureHeader = req.headers['x-hub-signature-256'];
  const signature = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader;
  if (!verifySignature(rawBody, signature)) {
    return send(res, 401, { error: 'Assinatura inválida.' });
  }

  let payload;
  try {
    payload = JSON.parse(rawBody.toString('utf8'));
  } catch {
    return send(res, 400, { error: 'Payload JSON inválido.' });
  }

  if (!isValidInstagramPayload(payload)) {
    // Autenticado, mas fora do escopo aceito nesta fundação. 200 evita que a
    // Meta entre em loop de retentativas para um evento que nunca vamos processar.
    return send(res, 200, { ok: true, ignored: true });
  }

  console.log('Instagram webhook: evento recebido.', safeLogMeta(payload));

  // Fundação apenas: nenhuma chamada ao agente/Gemini, nenhuma persistência e
  // nenhuma resposta ao cliente final acontece aqui (INST-05 em diante).
  return send(res, 200, { ok: true, accepted: true, entries: payload.entry.length });
}
