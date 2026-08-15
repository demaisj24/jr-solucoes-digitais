const MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash';
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

const buckets = new Map();
const LIMIT = 10;
const WINDOW_MS = 60 * 60 * 1000;

function corsOrigin(req) {
  const origin = req.headers.origin || '';
  const allowed = new Set([
    'https://vencivo.com.br',
    'https://www.vencivo.com.br',
    'http://localhost:3000',
    'http://localhost:5173'
  ]);
  return allowed.has(origin) ? origin : 'https://vencivo.com.br';
}

function json(res, status, body, origin) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Vary', 'Origin');
  return res.json(body);
}

function clientKey(req) {
  const forwarded = req.headers['x-forwarded-for'];
  return String(forwarded || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
}

function rateLimited(key) {
  const now = Date.now();
  const current = buckets.get(key);
  if (!current || now - current.startedAt > WINDOW_MS) {
    buckets.set(key, { startedAt: now, count: 1 });
    return false;
  }
  if (current.count >= LIMIT) return true;
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
  if (req.method === 'OPTIONS') return json(res, 204, {}, origin);
  if (req.method !== 'POST') return json(res, 405, { error: 'Método não permitido.' }, origin);
  if (!process.env.GEMINI_API_KEY) return json(res, 500, { error: 'IA não configurada no servidor.' }, origin);

  if (rateLimited(clientKey(req))) {
    return json(res, 429, { error: 'Limite da demonstração atingido. Aguarde alguns minutos e tente novamente.' }, origin);
  }

  try {
    const body = req.body || {};
    const systemPrompt = String(body.system_prompt || '').trim().slice(0, 12000);
    const newMessage = String(body.nova_mensagem || '').trim().slice(0, 2000);
    const history = normalizeHistory(body.historico_mensagens);

    if (!systemPrompt || !newMessage) {
      return json(res, 400, { error: 'system_prompt e nova_mensagem são obrigatórios.' }, origin);
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
        generationConfig: {
          temperature: 0.35,
          maxOutputTokens: 300
        }
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

    if (!text) return json(res, 502, { error: 'A IA não retornou uma resposta válida.' }, origin);
    return json(res, 200, { reply: text }, origin);
  } catch (error) {
    console.error('Chat endpoint error:', error);
    return json(res, 500, { error: 'Erro interno ao processar a demonstração.' }, origin);
  }
}
