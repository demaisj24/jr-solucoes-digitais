// INST-04 — Testes da fundação do webhook Instagram.
//
// Usa o test runner nativo do Node (node:test) — o repositório não possui
// nenhum framework de testes instalado, então nenhuma dependência nova foi
// adicionada. Rodar com:
//   node --test tests/
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

const APP_SECRET = 'test-app-secret-not-real';
const VERIFY_TOKEN = 'test-verify-token-not-real';

process.env.INSTAGRAM_APP_SECRET = APP_SECRET;
process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN = VERIFY_TOKEN;

let handler;
let dedupeKeyForEntry;

before(async () => {
  const mod = await import('../api/instagram-webhook.js');
  handler = mod.default;
  dedupeKeyForEntry = mod.dedupeKeyForEntry;
});

function sign(bodyString, secret = APP_SECRET) {
  const hex = crypto.createHmac('sha256', secret).update(bodyString).digest('hex');
  return `sha256=${hex}`;
}

function createReq({ method, query = {}, headers = {}, body }) {
  const bodyBuffer = body === undefined ? Buffer.alloc(0) : Buffer.isBuffer(body) ? body : Buffer.from(body);
  return {
    method,
    query,
    headers,
    async *[Symbol.asyncIterator]() {
      // Simula o streaming de chunks de um IncomingMessage real do Node,
      // em vez de entregar o corpo inteiro de uma vez.
      const chunkSize = 16;
      for (let i = 0; i < bodyBuffer.length; i += chunkSize) {
        yield bodyBuffer.subarray(i, i + chunkSize);
      }
    },
  };
}

function createRes() {
  return {
    statusCode: undefined,
    headers: {},
    body: undefined,
    ended: false,
    setHeader(key, value) {
      this.headers[key] = value;
    },
    end(data) {
      this.body = data;
      this.ended = true;
      return this;
    },
  };
}

function jsonOf(res) {
  return JSON.parse(res.body);
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
  const req = createReq({
    method: 'GET',
    query: { 'hub.mode': 'subscribe', 'hub.verify_token': VERIFY_TOKEN, 'hub.challenge': 'challenge-123' },
  });
  const res = createRes();
  await handler(req, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body, 'challenge-123');
  assert.match(String(res.headers['Content-Type']), /text\/plain/);
});

// 2. GET com token incorreto
test('GET com hub.verify_token incorreto é recusado', async () => {
  const req = createReq({
    method: 'GET',
    query: { 'hub.mode': 'subscribe', 'hub.verify_token': 'token-errado', 'hub.challenge': 'challenge-123' },
  });
  const res = createRes();
  await handler(req, res);
  assert.equal(res.statusCode, 403);
});

// 3. GET sem parâmetros
test('GET sem parâmetros é recusado', async () => {
  const req = createReq({ method: 'GET', query: {} });
  const res = createRes();
  await handler(req, res);
  assert.equal(res.statusCode, 403);
});

// 4. POST com assinatura válida
test('POST com assinatura válida e evento Instagram válido é aceito', async () => {
  const body = JSON.stringify(validPayload);
  const req = createReq({ method: 'POST', headers: { 'x-hub-signature-256': sign(body) }, body });
  const res = createRes();
  await handler(req, res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(jsonOf(res), { ok: true, accepted: true, entries: 1 });
});

// 5. POST com assinatura inválida
test('POST com assinatura inválida é rejeitado', async () => {
  const body = JSON.stringify(validPayload);
  const req = createReq({
    method: 'POST',
    headers: { 'x-hub-signature-256': 'sha256=' + '0'.repeat(64) },
    body,
  });
  const res = createRes();
  await handler(req, res);
  assert.equal(res.statusCode, 401);
});

// 6. POST sem assinatura
test('POST sem cabeçalho de assinatura é rejeitado', async () => {
  const body = JSON.stringify(validPayload);
  const req = createReq({ method: 'POST', headers: {}, body });
  const res = createRes();
  await handler(req, res);
  assert.equal(res.statusCode, 401);
});

// 7. POST com payload inválido (JSON malformado, mas assinado corretamente)
test('POST com JSON inválido (porém assinado) é rejeitado como payload inválido', async () => {
  const body = '{ isso não é json';
  const req = createReq({ method: 'POST', headers: { 'x-hub-signature-256': sign(body) }, body });
  const res = createRes();
  await handler(req, res);
  assert.equal(res.statusCode, 400);
});

// 8. Evento não Instagram
test('Evento autenticado que não é do Instagram é ignorado com segurança', async () => {
  const nonInstagram = { object: 'page', entry: [{ id: '1' }] };
  const body = JSON.stringify(nonInstagram);
  const req = createReq({ method: 'POST', headers: { 'x-hub-signature-256': sign(body) }, body });
  const res = createRes();
  await handler(req, res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(jsonOf(res), { ok: true, ignored: true });
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
  const req = createReq({ method: 'POST', headers: { 'x-hub-signature-256': sign(body) }, body });
  const res = createRes();
  await handler(req, res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(jsonOf(res), { ok: true, accepted: true, entries: 2 });
});

// 10. Comportamento seguro diante de evento duplicado
test('Evento duplicado é tratado de forma determinística e sem processar de fato', async () => {
  const body = JSON.stringify(validPayload);
  const headers = { 'x-hub-signature-256': sign(body) };

  const res1 = createRes();
  await handler(createReq({ method: 'POST', headers, body }), res1);
  const res2 = createRes();
  await handler(createReq({ method: 'POST', headers, body }), res2);

  // Nenhum processamento definitivo ocorre nesta fundação, então entregar o
  // mesmo evento duas vezes precisa produzir exatamente a mesma resposta,
  // sem efeito colateral cumulativo.
  assert.deepEqual(jsonOf(res1), jsonOf(res2));

  // A chave de deduplicação que o INST-05 usará para persistir/deduplicar é
  // determinística para a mesma entrada...
  const key1 = dedupeKeyForEntry(validPayload.entry[0]);
  const key2 = dedupeKeyForEntry(validPayload.entry[0]);
  assert.equal(key1, key2);

  // ...e diferente para entradas diferentes.
  const otherKey = dedupeKeyForEntry({ ...validPayload.entry[0], id: 'outro-id' });
  assert.notEqual(key1, otherKey);
});

// Bônus — payload maior que o limite aceito
test('Payload acima do limite máximo é rejeitado com 413', async () => {
  const bigBody = JSON.stringify({ object: 'instagram', entry: [{ id: 'x', pad: 'a'.repeat(1024 * 1024 + 10) }] });
  const req = createReq({ method: 'POST', headers: { 'x-hub-signature-256': sign(bigBody) }, body: bigBody });
  const res = createRes();
  await handler(req, res);
  assert.equal(res.statusCode, 413);
});

// Bônus — método não suportado
test('Método não suportado (ex.: DELETE) é rejeitado', async () => {
  const req = createReq({ method: 'DELETE' });
  const res = createRes();
  await handler(req, res);
  assert.equal(res.statusCode, 405);
});

// Bônus — nunca expõe o segredo em nenhuma resposta
test('Nenhuma resposta do webhook contém o APP_SECRET ou o VERIFY_TOKEN', async () => {
  const body = JSON.stringify(validPayload);
  const req = createReq({ method: 'POST', headers: { 'x-hub-signature-256': sign(body) }, body });
  const res = createRes();
  await handler(req, res);
  const raw = String(res.body);
  assert.ok(!raw.includes(APP_SECRET));
  assert.ok(!raw.includes(VERIFY_TOKEN));
});

// Bônus — GET quando o token de verificação não está configurado no servidor
test('GET responde 503 quando INSTAGRAM_WEBHOOK_VERIFY_TOKEN não está configurado', async () => {
  const savedToken = process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN;
  delete process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN;
  try {
    const mod = await import(`../api/instagram-webhook.js?variant=no-verify-token`);
    const req = createReq({
      method: 'GET',
      query: { 'hub.mode': 'subscribe', 'hub.verify_token': 'qualquer', 'hub.challenge': 'x' },
    });
    const res = createRes();
    await mod.default(req, res);
    assert.equal(res.statusCode, 503);
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
    const req = createReq({ method: 'POST', headers: { 'x-hub-signature-256': 'sha256=' + '0'.repeat(64) }, body });
    const res = createRes();
    await mod.default(req, res);
    assert.equal(res.statusCode, 503);
  } finally {
    process.env.INSTAGRAM_APP_SECRET = savedSecret;
  }
});
