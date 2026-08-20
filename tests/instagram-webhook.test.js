// INST-04 / INST-04A — Testes da fundação do webhook Instagram.
//
// Usa o test runner nativo do Node (node:test) e os objetos Request/Response
// padrão da Web, globais no Node 18+ — nenhuma dependência nova foi
// adicionada. Rodar com:
//   node --test tests/instagram-webhook.test.js
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

const APP_SECRET = 'test-app-secret-not-real';
const VERIFY_TOKEN = 'test-verify-token-not-real';

process.env.INSTAGRAM_APP_SECRET = APP_SECRET;
process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN = VERIFY_TOKEN;

let GET;
let POST;
let dedupeKeyForEntry;

before(async () => {
  const mod = await import('../api/instagram-webhook.js');
  GET = mod.GET;
  POST = mod.POST;
  dedupeKeyForEntry = mod.dedupeKeyForEntry;
});

function sign(bodyBytes, secret = APP_SECRET) {
  const hex = crypto.createHmac('sha256', secret).update(bodyBytes).digest('hex');
  return `sha256=${hex}`;
}

function getRequest(params) {
  const url = new URL('https://example.vercel.app/api/instagram-webhook');
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) url.searchParams.set(k, v);
  }
  return new Request(url, { method: 'GET' });
}

function postRequest({ body, headers = {} } = {}) {
  return new Request('https://example.vercel.app/api/instagram-webhook', {
    method: 'POST',
    headers,
    body,
  });
}

async function jsonOf(res) {
  return JSON.parse(await res.text());
}

const validPayload = {
  object: 'instagram',
  entry: [
    {
      id: '17841400000000000',
      time: 1734000000,
      messaging: [
        {
          sender: { id: '123' },
          recipient: { id: '456' },
          timestamp: 1734000000,
          message: { mid: 'mid.abc', text: 'Olá' },
        },
      ],
    },
  ],
};

// 1. GET com token correto
test('GET com hub.verify_token correto responde com o challenge', async () => {
  const req = getRequest({ 'hub.mode': 'subscribe', 'hub.verify_token': VERIFY_TOKEN, 'hub.challenge': 'challenge-123' });
  const res = await GET(req);
  assert.equal(res.status, 200);
  assert.equal(await res.text(), 'challenge-123');
  assert.match(res.headers.get('content-type'), /text\/plain/);
});

// 2. GET com token incorreto
test('GET com hub.verify_token incorreto é recusado', async () => {
  const req = getRequest({ 'hub.mode': 'subscribe', 'hub.verify_token': 'token-errado', 'hub.challenge': 'challenge-123' });
  const res = await GET(req);
  assert.equal(res.status, 403);
});

// 3. GET sem parâmetros
test('GET sem parâmetros é recusado', async () => {
  const req = getRequest({});
  const res = await GET(req);
  assert.equal(res.status, 403);
});

// 4. POST com assinatura válida
test('POST com assinatura válida e evento Instagram válido é aceito', async () => {
  const body = JSON.stringify(validPayload);
  const req = postRequest({ body, headers: { 'x-hub-signature-256': sign(body) } });
  const res = await POST(req);
  assert.equal(res.status, 200);
  assert.deepEqual(await jsonOf(res), { ok: true, accepted: true, entries: 1 });
});

// 5. POST com assinatura inválida
test('POST com assinatura inválida é rejeitado', async () => {
  const body = JSON.stringify(validPayload);
  const req = postRequest({ body, headers: { 'x-hub-signature-256': 'sha256=' + '0'.repeat(64) } });
  const res = await POST(req);
  assert.equal(res.status, 401);
});

// 6. POST sem assinatura
test('POST sem cabeçalho de assinatura é rejeitado', async () => {
  const body = JSON.stringify(validPayload);
  const req = postRequest({ body });
  const res = await POST(req);
  assert.equal(res.status, 401);
});

// 7. POST com payload inválido (JSON malformado, mas assinado corretamente)
test('POST com JSON inválido (porém assinado) é rejeitado como payload inválido', async () => {
  const body = '{ isso não é json';
  const req = postRequest({ body, headers: { 'x-hub-signature-256': sign(body) } });
  const res = await POST(req);
  assert.equal(res.status, 400);
});

// 8. Evento não Instagram
test('Evento autenticado que não é do Instagram é ignorado com segurança', async () => {
  const nonInstagram = { object: 'page', entry: [{ id: '1' }] };
  const body = JSON.stringify(nonInstagram);
  const req = postRequest({ body, headers: { 'x-hub-signature-256': sign(body) } });
  const res = await POST(req);
  assert.equal(res.status, 200);
  assert.deepEqual(await jsonOf(res), { ok: true, ignored: true });
});

// 9. Payload Instagram válido (comentário, múltiplas entries)
test('Payload Instagram válido com múltiplas entradas é aceito', async () => {
  const multi = {
    object: 'instagram',
    entry: [
      { id: 'a', time: 1, changes: [{ field: 'comments', value: { id: 'c1', text: 'Oi' } }] },
      { id: 'b', time: 2, changes: [{ field: 'comments', value: { id: 'c2', text: 'Preço?' } }] },
    ],
  };
  const body = JSON.stringify(multi);
  const req = postRequest({ body, headers: { 'x-hub-signature-256': sign(body) } });
  const res = await POST(req);
  assert.equal(res.status, 200);
  assert.deepEqual(await jsonOf(res), { ok: true, accepted: true, entries: 2 });
});

// 10. Comportamento seguro diante de evento duplicado
test('Evento duplicado é tratado de forma determinística e sem processar de fato', async () => {
  const body = JSON.stringify(validPayload);
  const headers = { 'x-hub-signature-256': sign(body) };

  const res1 = await POST(postRequest({ body, headers }));
  const res2 = await POST(postRequest({ body, headers }));

  assert.deepEqual(await jsonOf(res1), await jsonOf(res2));

  const key1 = dedupeKeyForEntry(validPayload.entry[0]);
  const key2 = dedupeKeyForEntry(validPayload.entry[0]);
  assert.equal(key1, key2);

  const otherKey = dedupeKeyForEntry({ ...validPayload.entry[0], id: 'outro-id' });
  assert.notEqual(key1, otherKey);
});

// Bônus — payload maior que o limite aceito
test('Payload acima do limite máximo é rejeitado com 413', async () => {
  const bigBody = JSON.stringify({ object: 'instagram', entry: [{ id: 'x', pad: 'a'.repeat(1024 * 1024 + 10) }] });
  const req = postRequest({ body: bigBody, headers: { 'x-hub-signature-256': sign(bigBody) } });
  const res = await POST(req);
  assert.equal(res.status, 413);
});

// Bônus — nunca expõe o segredo em nenhuma resposta
test('Nenhuma resposta do webhook contém o APP_SECRET ou o VERIFY_TOKEN', async () => {
  const body = JSON.stringify(validPayload);
  const req = postRequest({ body, headers: { 'x-hub-signature-256': sign(body) } });
  const res = await POST(req);
  const raw = await res.text();
  assert.ok(!raw.includes(APP_SECRET));
  assert.ok(!raw.includes(VERIFY_TOKEN));
});

// Bônus — GET quando o token de verificação não está configurado no servidor
test('GET responde 503 quando INSTAGRAM_WEBHOOK_VERIFY_TOKEN não está configurado', async () => {
  const savedToken = process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN;
  delete process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN;
  try {
    const mod = await import(`../api/instagram-webhook.js?variant=no-verify-token`);
    const req = getRequest({ 'hub.mode': 'subscribe', 'hub.verify_token': 'qualquer', 'hub.challenge': 'x' });
    const res = await mod.GET(req);
    assert.equal(res.status, 503);
  } finally {
    process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN = savedToken;
  }
});

// Bônus — POST quando o app secret não está configurado no servidor
test('POST responde 503 quando INSTAGRAM_APP_SECRET não está configurado', async () => {
  const savedSecret = process.env.INSTAGRAM_APP_SECRET;
  delete process.env.INSTAGRAM_APP_SECRET;
  try {
    const mod = await import(`../api/instagram-webhook.js?variant=no-app-secret`);
    const body = JSON.stringify(validPayload);
    const req = postRequest({ body, headers: { 'x-hub-signature-256': 'sha256=' + '0'.repeat(64) } });
    const res = await mod.POST(req);
    assert.equal(res.status, 503);
  } finally {
    process.env.INSTAGRAM_APP_SECRET = savedSecret;
  }
});

// === INST-04A: testes específicos para a migração de raw body ===

// Bytes UTF-8: garante que a assinatura é calculada sobre os bytes UTF-8
// reais do corpo (acentos + emoji), não sobre length/serialização de string JS.
test('INST-04A: corpo com acentos e emoji (multibyte UTF-8) valida corretamente', async () => {
  const payload = {
    object: 'instagram',
    entry: [
      {
        id: 'utf8-entry',
        time: 1,
        messaging: [{ message: { mid: 'm1', text: 'Olá! Preço: R$ 147,00 😀 ção' } }],
      },
    ],
  };
  const body = JSON.stringify(payload);
  const bodyBytes = Buffer.from(body, 'utf8');
  // Assinatura calculada explicitamente sobre os bytes (não sobre a string).
  const signature = sign(bodyBytes);
  const req = postRequest({ body: bodyBytes, headers: { 'x-hub-signature-256': signature } });
  const res = await POST(req);
  assert.equal(res.status, 200);
  assert.deepEqual(await jsonOf(res), { ok: true, accepted: true, entries: 1 });
});

// Corpo alterado depois da assinatura: assina o corpo A, mas envia o corpo B.
test('INST-04A: corpo alterado depois de assinado é rejeitado (assinatura não bate)', async () => {
  const bodyA = JSON.stringify(validPayload);
  const bodyB = JSON.stringify({ ...validPayload, entry: [{ ...validPayload.entry[0], id: 'id-diferente' }] });
  const signatureOfA = sign(bodyA);
  const req = postRequest({ body: bodyB, headers: { 'x-hub-signature-256': signatureOfA } });
  const res = await POST(req);
  assert.equal(res.status, 401);
});

// Corpo vazio: assinatura calculada sobre buffer vazio é aceita pela
// verificação de assinatura, mas falha no parse JSON em seguida.
test('INST-04A: corpo vazio com assinatura correspondente (vazia) é rejeitado como payload inválido', async () => {
  const req = postRequest({ body: undefined, headers: { 'x-hub-signature-256': sign(Buffer.alloc(0)) } });
  const res = await POST(req);
  // Sem corpo, request.body é null -> readRawBody retorna buffer vazio ->
  // assinatura de buffer vazio bate -> JSON.parse('') falha -> 400.
  assert.equal(res.status, 400);
});

// Payload acima de 1 MB (reafirma o teste já existente, agora via Request real).
test('INST-04A: payload de exatamente 1MB + 1 byte é rejeitado com 413', async () => {
  const oversized = Buffer.alloc(1024 * 1024 + 1, 'a');
  const req = postRequest({ body: oversized, headers: { 'x-hub-signature-256': sign(oversized) } });
  const res = await POST(req);
  assert.equal(res.status, 413);
});
