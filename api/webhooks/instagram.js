import crypto from 'node:crypto';

export const config = { api: { bodyParser: false } };

const VERIFY_TOKEN = process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN || '';
const APP_SECRET = process.env.META_APP_SECRET || '';
const MAX_BODY_BYTES = 1024 * 1024;

function send(res, status, body, type = 'application/json') {
  res.statusCode = status;
  res.setHeader('Content-Type', `${type}; charset=utf-8`);
  res.setHeader('Cache-Control', 'no-store');
  return res.end(type === 'text/plain' ? String(body) : JSON.stringify(body));
}

async function rawBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new Error('PAYLOAD_TOO_LARGE');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function timingSafeEqualHex(actual, expected) {
  if (!actual || !expected || actual.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(actual, 'hex'), Buffer.from(expected, 'hex'));
}

function verifySignature(body, header) {
  if (!APP_SECRET || !header?.startsWith('sha256=')) return false;
  const received = header.slice('sha256='.length).trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(received)) return false;
  const expected = crypto.createHmac('sha256', APP_SECRET).update(body).digest('hex');
  return timingSafeEqualHex(received, expected);
}

function validateEvent(payload) {
  if (!payload || payload.object !== 'instagram' || !Array.isArray(payload.entry)) return false;
  return payload.entry.every((entry) => entry && typeof entry.id === 'string');
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const query = req.query || {};
    const mode = String(query['hub.mode'] || '');
    const token = String(query['hub.verify_token'] || '');
    const challenge = String(query['hub.challenge'] || '');

    if (!VERIFY_TOKEN) return send(res, 503, { error: 'Webhook de Instagram não configurado.' });
    if (mode !== 'subscribe' || token !== VERIFY_TOKEN || !challenge) {
      return send(res, 403, { error: 'Verificação do webhook recusada.' });
    }
    return send(res, 200, challenge, 'text/plain');
  }

  if (req.method !== 'POST') return send(res, 405, { error: 'Método não permitido.' });
  if (!APP_SECRET) return send(res, 503, { error: 'Segredo do Meta App não configurado.' });

  try {
    const body = await rawBody(req);
    const signature = req.headers['x-hub-signature-256'];
    if (!verifySignature(body, String(signature || ''))) {
      return send(res, 401, { error: 'Assinatura do webhook inválida.' });
    }

    let payload;
    try {
      payload = JSON.parse(body.toString('utf8'));
    } catch {
      return send(res, 400, { error: 'Payload JSON inválido.' });
    }

    if (!validateEvent(payload)) return send(res, 400, { error: 'Evento Instagram inválido.' });

    // META-GATE-02: nesta etapa apenas validamos autenticidade e estrutura.
    // Persistência, deduplicação e processamento comercial entram no próximo gate,
    // depois que o endpoint for validado com uma conta profissional real.
    return send(res, 200, { ok: true, accepted: true, entries: payload.entry.length });
  } catch (error) {
    if (error?.message === 'PAYLOAD_TOO_LARGE') return send(res, 413, { error: 'Payload muito grande.' });
    console.error('Instagram webhook:', error);
    return send(res, 500, { error: 'Erro interno no webhook.' });
  }
}
