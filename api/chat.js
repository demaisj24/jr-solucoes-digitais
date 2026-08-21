const CONFIGURED_MODEL = process.env.GEMINI_MODEL || '';
const MODEL = CONFIGURED_MODEL === 'gemini-3.5-flash' || !CONFIGURED_MODEL
  ? 'gemini-3.1-flash-lite'
  : CONFIGURED_MODEL;
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

// SEC-13: rate limiting durável via RPC no Supabase (substitui Map() em memória,
// que não é compartilhada entre instâncias serverless). Fail-open: se o RPC falhar
// ou estourar o timeout, a requisição é permitida e o erro é logado.
const SUPABASE_URL = 'https://uxmlmyhiagjefuufanyg.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const SESSION_LIMIT = 10;
const IP_LIMIT = 30;
const RATE_LIMIT_WINDOW_SECONDS = 60 * 60;
const RATE_LIMIT_TIMEOUT_MS = 1000;
const GEMINI_TIMEOUT_MS = 12000;

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

async function rateLimitHit(key, limit) {
  if (!SERVICE_ROLE_KEY) {
    console.error('rate_limit_hit sem SUPABASE_SERVICE_ROLE_KEY configurada, permitindo requisição (fail-open)', { key });
    return false;
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), RATE_LIMIT_TIMEOUT_MS);
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/rate_limit_hit`, {
      method: 'POST',
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ p_key: key, p_limit: limit, p_window_seconds: RATE_LIMIT_WINDOW_SECONDS }),
      signal: controller.signal
    });
    if (!r.ok) {
      console.error('rate_limit_hit retornou erro HTTP, permitindo requisição (fail-open)', { key, status: r.status });
      return false;
    }
    return await r.json();
  } catch (error) {
    console.error('rate_limit_hit falhou, permitindo requisição (fail-open)', { key, error: error?.message });
    return false;
  } finally {
    clearTimeout(timer);
  }
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
    if (sessionId && await rateLimitHit(`chat:session:${ip}:${sessionId}`, SESSION_LIMIT)) {
      return json(res, 429, { error: 'Você atingiu o limite desta demonstração. Fale com a VENCIVO para colocar seu agente funcionando de verdade.' }, origin);
    }
    if (await rateLimitHit(`chat:ip:${ip}`, IP_LIMIT)) {
      return json(res, 429, { error: 'A demonstração está temporariamente indisponível para este acesso. Tente novamente mais tarde.' }, origin);
    }

    const contents = [...history, { role: 'user', parts: [{ text: newMessage }] }];
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

    let response;
    try {
      response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': process.env.GEMINI_API_KEY
        },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents,
          generationConfig: {
            maxOutputTokens: 180,
            thinkingConfig: { thinkingLevel: 'minimal' }
          }
        }),
        signal: controller.signal
      });
    } catch (error) {
      if (error?.name === 'AbortError') {
        return json(res, 504, { error: 'A IA demorou para responder. Tente novamente em alguns segundos.' }, origin);
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }

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
      console.error('Gemini empty response:', payload);
      return json(res, 502, { error: 'A IA não retornou uma resposta válida.' }, origin);
    }

    return json(res, 200, { reply: text }, origin);
  } catch (error) {
    console.error('Chat endpoint error:', error);
    return json(res, 500, { error: 'Erro interno ao processar a demonstração.' }, origin);
  }
}
