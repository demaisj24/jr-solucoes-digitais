const MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

// Proteção da demonstração pública. A quota comercial definitiva deverá usar armazenamento persistente.
const buckets = new Map();
const SESSION_LIMIT = 10;
const IP_LIMIT = 30;
const WINDOW_MS = 60 * 60 * 1000;
const GOOGLE_TIMEOUT_MS = 17000;

function corsOrigin(req) {
  const origin = String(req.headers.origin || '').trim();
  if (!origin) return 'https://vencivo.com.br';

  try {
    const url = new URL(origin);
    const hostname = url.hostname.toLowerCase();
    const allowed =
      hostname === 'vencivo.com.br' ||
      hostname === 'www.vencivo.com.br' ||
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === 'vencivo-ai.vercel.app' ||
      hostname.endsWith('.vercel.app');
    return allowed ? origin : 'https://vencivo.com.br';
  } catch {
    return 'https://vencivo.com.br';
  }
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
  return history.slice(-10).map((m) => ({
    role: m?.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: String(m?.content || '').slice(0, 1500) }]
  })).filter((m) => m.parts[0].text.trim());
}

const EXPERT_BEHAVIOR = `

COMPORTAMENTO DE ASSISTENTE EXPERIENTE:
- Você deve se comportar como um atendente humano experiente naquele negócio, não como um chatbot genérico.
- Antes de responder, identifique a intenção do cliente e use o conhecimento oficial disponível para dar a resposta mais útil e prática possível.
- Comece pela resposta que o cliente normalmente espera de um bom atendente: direta, clara e contextualizada. Não comece com frases vagas como "posso ajudar?" quando a pergunta já foi feita.
- Quando perguntarem sobre serviços, apresente os serviços cadastrados de forma organizada e, se houver detalhes oficiais, explique brevemente para quem são indicados.
- Quando perguntarem preço, horário, localização, formas de pagamento, funcionamento ou regras, responda com os dados cadastrados. Nunca complete lacunas com suposições.
- Quando o cliente demonstrar intenção de comprar, contratar ou agendar, conduza a conversa para o próximo passo útil, fazendo apenas as perguntas necessárias.
- Se faltar uma informação necessária para concluir o atendimento, diga exatamente o que falta e encaminhe para humano quando apropriado.
- Faça perguntas de esclarecimento somente quando realmente necessárias; evite interrogatórios.
- Não repita informações que o cliente acabou de fornecer.
- Não diga que "aprendeu" ou que recebeu um arquivo; simplesmente use o conhecimento disponível.
- Mantenha linguagem natural em português do Brasil, profissional e compatível com o segmento.
- O cliente deve perceber que está falando com alguém que conhece profundamente a empresa.
`;

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
    let systemPrompt = String(body.system_prompt || '').trim().slice(0, 10000);
    const newMessage = String(body.nova_mensagem || '').trim().slice(0, 1500);
    const history = normalizeHistory(body.historico_mensagens);
    const sessionId = String(body.session_id || '').trim().slice(0, 100);

    if (!systemPrompt || !newMessage) {
      return json(res, 400, { error: 'system_prompt e nova_mensagem são obrigatórios.' }, origin);
    }

    // O comportamento especialista é aplicado no servidor para manter uma camada de segurança
    // mesmo que o cliente altere o JavaScript da demonstração.
    systemPrompt += EXPERT_BEHAVIOR;

    // O limite de sessão protege a demonstração; o limite por IP reduz abuso automatizado.
    const ip = clientIp(req);
    if (sessionId && bucketHit(`session:${ip}:${sessionId}`, SESSION_LIMIT)) {
      return json(res, 429, { error: 'Você atingiu o limite desta demonstração. Fale com a VENCIVO para colocar seu agente funcionando de verdade.' }, origin);
    }
    if (bucketHit(`ip:${ip}`, IP_LIMIT)) {
      return json(res, 429, { error: 'A demonstração está temporariamente indisponível para este acesso. Tente novamente mais tarde.' }, origin);
    }

    const contents = [...history, { role: 'user', parts: [{ text: newMessage }] }];
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), GOOGLE_TIMEOUT_MS);

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
            maxOutputTokens: 420,
            thinkingConfig: { thinkingLevel: 'MINIMAL' }
          }
        }),
        signal: controller.signal
      });
    } catch (error) {
      if (error?.name === 'AbortError') {
        return json(res, 504, { error: 'A IA demorou mais que o esperado. Tente novamente.' }, origin);
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }

    const payload = await response.json();
    if (!response.ok) {
      console.error('Gemini error:', response.status, payload);
      return json(res, 502, { error: 'Não foi possível obter a resposta da IA agora.', provider_status: response.status }, origin);
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
