export default async function handler(req, res) {
  res.status(200).json({ ok: true, service: 'vencivo-ai', model: 'gemini-3.1-flash-lite' });
}
