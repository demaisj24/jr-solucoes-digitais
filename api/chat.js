const CONFIGURED_MODEL = process.env.GEMINI_MODEL || '';
const MODEL = CONFIGURED_MODEL === 'gemini-3.5-flash' || !CONFIGURED_MODEL
  ? 'gemini-3.1-flash-lite'
  : CONFIGURED_MODEL;
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

// SEC-13 (Fase 3): rate limiting durável via RPC no Supabase (substitui Map() em
// memória, que não é compartilhada entre instâncias serverless).
// SEC-13 (Fase 4 — correção F1/F2): (a) o limite por IP é checado ANTES do de
// sessão — uma requisição já bloqueada por IP nunca cria/atualiza bucket de
// sessão; (b) session_id (controlado pelo cliente) é reduzido a 1 de
// SESSION_SLOTS "slots" via hash local determinístico antes de virar chave —
// limita a cardinalidade máxima de buckets de sessão por IP, em vez de deixar o
// cliente criar infinitas chaves distintas; (c) se o RPC falhar/expirar, cai num
// fallback local conservador e efêmero (nunca é fonte de verdade, só evita
// bypass ilimitado durante uma degradação do Supabase) — ver rateLimitHit().
const SUPABASE_URL = 'https://uxmlmyhiagjefuufanyg.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const SESSION_LIMIT = 10;
const IP_LIMIT = 30;
const RATE_LIMIT_WINDOW_SECONDS = 60 * 60;
const RATE_LIMIT_TIMEOUT_MS = 1000;
const SESSION_SLOTS = 256;
const FALLBACK_RATIO = 0.2;
const FALLBACK_WINDOW_MS = 5 * 60 * 1000;
const FALLBACK_MAX_ENTRIES = 500;
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

// Hash local determinístico (djb2), sem dependência nova e sem segredo: o efeito
// de limitar a cardinalidade vale mesmo que o atacante conheça a fórmula, porque
// o número de slots é fixo (pombos-e-casas). Só decide EM QUAL bucket de sessão a
// requisição cai — o RPC continua sendo a fonte de verdade da contagem.
function sessionSlot(sessionId, slots) {
  let h = 5381;
  for (let i = 0; i < sessionId.length; i++) {
    h = ((h * 33) ^ sessionId.charCodeAt(i)) >>> 0;
  }
  return h % slots;
}

// Fallback local, usado SÓ quando o RPC falha/expira (ver rateLimitHit). Nunca é
// fonte de verdade — é uma trava de emergência: limite bem mais conservador
// (FALLBACK_RATIO do limite real), janela curta (FALLBACK_WINDOW_MS) e tamanho
// máximo (FALLBACK_MAX_ENTRIES, descartando o bucket mais antigo ao estourar) —
// garantem que não há crescimento ilimitado de memória mesmo sob abuso durante
// uma degradação do Supabase.
const fallbackBuckets = new Map();
function fallbackHit(key, limit) {
  const fallbackLimit = Math.max(1, Math.floor(limit * FALLBACK_RATIO));
  const now = Date.now();
  const entry = fallbackBuckets.get(key);
  if (!entry || now - entry.startedAt > FALLBACK_WINDOW_MS) {
    if (!entry && fallbackBuckets.size >= FALLBACK_MAX_ENTRIES) {
      fallbackBuckets.delete(fallbackBuckets.keys().next().value);
    }
    fallbackBuckets.set(key, { startedAt: now, count: 1 });
    return false;
  }
  if (entry.count >= fallbackLimit) return true;
  entry.count += 1;
  return false;
}

async function rateLimitHit(key, limit) {
  if (!SERVICE_ROLE_KEY) {
    const blocked = fallbackHit(key, limit);
    console.error('SEC13_RATE_LIMIT_FALLBACK', { reason: 'missing_service_role_key', key, limit, blocked });
    return blocked;
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
      const blocked = fallbackHit(key, limit);
      console.error('SEC13_RATE_LIMIT_FALLBACK', { reason: 'http_error', key, limit, status: r.status, blocked });
      return blocked;
    }
    return await r.json();
  } catch (error) {
    const blocked = fallbackHit(key, limit);
    console.error('SEC13_RATE_LIMIT_FALLBACK', { reason: 'exception', key, limit, error: error?.message, blocked });
    return blocked;
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
    // SEC-13 Fase 4: IP antes de sessão — se o IP já estourou, nem chegamos a
    // criar/atualizar o bucket de sessão.
    if (await rateLimitHit(`chat:ip:${ip}`, IP_LIMIT)) {
      return json(res, 429, { error: 'A demonstração está temporariamente indisponível para este acesso. Tente novamente mais tarde.' }, origin);
    }
    if (sessionId && await rateLimitHit(`chat:session:${ip}:${sessionSlot(sessionId, SESSION_SLOTS)}`, SESSION_LIMIT)) {
      return json(res, 429, { error: 'Você atingiu o limite desta demonstração. Fale com a VENCIVO para colocar seu agente funcionando de verdade.' }, origin);
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

// Exports nomeados adicionais só para teste (tests/sec-13-fase4-*.test.js). O
// runtime da Vercel usa exclusivamente o export default acima; exports extras
// são inertes em produção.
export { rateLimitHit, fallbackHit, sessionSlot, fallbackBuckets, clientIp };
