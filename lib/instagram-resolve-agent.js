// VENCIVO / INST-08A — Resolução instagram_webhook_events -> agent_id.
//
// NÃO é um endpoint da Vercel: fica fora de api/ de propósito, para nunca
// contar contra o limite de Serverless Functions do plano Hobby (ver
// docs/INSTAGRAM-AGENT-RESOLUTION.md). É importado por quem precisar
// (futuro worker, ainda não implementado nesta tarefa).
//
// Escopo estrito: só resolve identidade (instagram_user_id -> agent_id +
// owner_id), com verificação multi-tenant redundante à do banco. Nunca
// chama Gemini, nunca envia resposta ao Instagram, nunca lê/grava token,
// nunca persiste nada em instagram_webhook_events.

const SUPABASE_URL = 'https://uxmlmyhiagjefuufanyg.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const MAX_INSTAGRAM_USER_ID_LENGTH = 128;

async function sb(path) {
  if (!SERVICE_ROLE_KEY) throw new Error('Supabase não configurado no servidor.');
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
  });
  const p = await r.json().catch(() => null);
  if (!r.ok) {
    console.error('instagram-resolve-agent: falha ao consultar o banco', r.status);
    throw new Error('Falha ao consultar dados de identidade do Instagram.');
  }
  return p;
}

/**
 * Lógica pura de decisão — sem I/O, testável sem rede/banco. Recebe as
 * linhas já buscadas (ou null) e decide o resultado. Toda a "não confiar
 * só numa constraint de escrita" mora aqui: revalida owner_id mesmo que
 * o FK composto do banco já devesse garantir isso.
 *
 * @param {{connection: object|null, agent: object|null}} rows
 * @returns {{ok: true, agent_id: string, owner_id: string} | {ok: false, reason: string}}
 */
export function resolveFromRows({ connection, agent }) {
  if (!connection) {
    return { ok: false, reason: 'connection_not_found' };
  }
  if (connection.status === 'revoked') {
    return { ok: false, reason: 'connection_revoked' };
  }
  if (connection.status !== 'active') {
    // Cobre 'error' e qualquer valor futuro fora de active/revoked que o
    // CHECK do banco ainda não rejeitou explicitamente aqui.
    return { ok: false, reason: 'connection_error' };
  }
  if (!agent) {
    // Defensivo: sob o FK composto normal, uma connection 'active' sempre
    // tem um agents correspondente com o mesmo owner_id (o FK cascateia a
    // remoção da connection se o agente for apagado). Não deveria
    // acontecer — mantido para nunca resolver "no escuro".
    return { ok: false, reason: 'agent_not_found' };
  }
  if (agent.owner_id !== connection.owner_id) {
    // Nunca deveria disparar em produção (o FK composto já impede isso na
    // escrita) — é a rede de segurança da aplicação, independente do banco.
    return { ok: false, reason: 'owner_mismatch' };
  }
  if (agent.status !== 'active') {
    // Decisão deliberada: só agente 'active' responde no Instagram, canal
    // de cliente final. 'demo' (default pós-criação), 'draft', 'paused' e
    // 'archived' são todos tratados como inativos para este fim.
    return { ok: false, reason: 'agent_inactive' };
  }
  return { ok: true, agent_id: agent.id, owner_id: agent.owner_id };
}

function isValidInstagramUserId(value) {
  return typeof value === 'string' && value.length > 0 && value.length <= MAX_INSTAGRAM_USER_ID_LENGTH;
}

/**
 * Resolve o agente responsável por um instagram_user_id, consultando o
 * Supabase real (service role). Só leitura — nunca escreve em
 * instagram_connections, agents ou instagram_webhook_events.
 *
 * @param {string} instagramUserId - entry.id do payload do webhook.
 * @returns {Promise<{ok: true, agent_id: string, owner_id: string} | {ok: false, reason: string}>}
 */
export async function resolveAgentForInstagramEvent(instagramUserId) {
  if (!isValidInstagramUserId(instagramUserId)) {
    return { ok: false, reason: 'invalid_instagram_user_id' };
  }

  const connections = await sb(
    `instagram_connections?instagram_user_id=eq.${encodeURIComponent(instagramUserId)}&select=agent_id,owner_id,status&limit=1`
  );
  const connection = connections?.[0] || null;

  if (!connection || connection.status !== 'active') {
    return resolveFromRows({ connection, agent: null });
  }

  // Consulta explícita por (id, owner_id) — não confia só no FK composto
  // do banco para garantir o isolamento multi-tenant nesta leitura.
  const agents = await sb(
    `agents?id=eq.${encodeURIComponent(connection.agent_id)}&owner_id=eq.${encodeURIComponent(connection.owner_id)}&select=id,owner_id,status&limit=1`
  );
  const agent = agents?.[0] || null;

  return resolveFromRows({ connection, agent });
}
