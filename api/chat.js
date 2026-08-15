const MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash';
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

const buckets = new Map();
const SESSION_LIMIT = 10;
const IP_LIMIT = 30;
const WINDOW_MS = 60 * 60 * 1000;

function corsOrigin(req) {
  const origin = String(req.headers.origin || '').trim();
  const allowed = new Set([
    'https://vencivo.com.br',
    'https://www.vencivo.com.br',
    'https://vencivo-ai.vercel.app',
    'http://localhost:3000',
    'http://localhost:5173'
  ]);
  return allowed.has(origin) ? origin : 'https://vencivo.com.br';
}

function setCors(res, origin) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Vary', 'Origin');
}

function json(res, status, body, origin) {
  setCors(res, origin);
  return res.status(status).json(body);
}

function clientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  return String(forwarded || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
}

function bucketHit(key, limit) {
  const now = Date.now();
  const current = buckets.get(key);
  if (!current || now - current.startedAt > WINDOW_MS) {
    buckets.set(key, { startedAt: now, count: 1 });
    return false;
  }
  if (current.count >= limit) return true;
  current.count += 1;
  return false;
}

function normalizeHistory(history) {
  if (!Array.isArray(history)) return [];
  return history.slice(-12).map((m) => ({
    role: m?.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: String(m?.content || '').slice(0, 2000) }]
  })).filter((m) => m.parts[0].text.trim());
}

export default async function handler(req, res) {
  const origin = corsOrigin(req);

  if (req.method === 'OPTIONS') {
    setCors(res, origin);
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Método não permitido.' }, origin);
  }

  if (!process.env.GEMINI_API_KEY) {
    return json(res, 500, { error: 'IA não configurada no servidor.' }, origin);
  }

  try {
    const body = req.body || {};
    const systemPrompt = String(body.system_prompt || '').trim().slice(0, 12000);
    const newMessage = String(body.nova_mensagem || '').trim().slice(0, 2000);
    const history = normalizeHistory(body.historico_mensagens);
    const sessionId = String(body.session_id || '').trim().slice(0, 100);

    if (!systemPrompt || !newMessage) {
      return json(res, 400, { error: 'system_prompt e nova_mensagem são obrigatórios.' }, origin);
    }

    const ip = clientIp(req);
    if (sessionId && bucketHit(`session:${ip}:${sessionId}`, SESSION_LIMIT)) {
      return json(res, 429, { error: 'Você atingiu o limite desta demonstração. Fale com a VENCIVO para colocar seu agente funcionando de verdade.' }, origin);
    }
    if (bucketHit(`ip:${ip}`, IP_LIMIT)) {
      return json(res, 429, { error: 'A demonstração está temporariamente indisponível para este acesso. Tente novamente mais tarde.' }, origin);
    }

    const contents = [...history, { role: 'user', parts: [{ text: newMessage }] }];
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': process.env.GEMINI_API_KEY
      },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents,
        generationConfig: { maxOutputTokens: 300 }
      })
    });

    const payload = await response.json();
    if (!response.ok) {
      console.error('Gemini error:', response.status, payload);
      return json(res, 502, { error: 'Não foi possível obter a resposta da IA agora.' }, origin);
    }

    const text = payload?.candidates?.[0]?.content?.parts
      ?.map((p) => p.text || '')
      .join('')
      .trim();

    if (!text) {
      return json(res, 502, { error: 'A IA não retornou uma resposta válida.' }, origin);
    }

    return json(res, 200, { reply: text }, origin);
  } catch (error) {
    console.error('Chat endpoint error:', error);
    return json(res, 500, { error: 'Erro interno ao processar a demonstração.' }, origin);
  }
}
