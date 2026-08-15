export default async function handler(req, res) {
  res.status(200).json({ ok: true, service: 'vencivo-ai', model: process.env.GEMINI_MODEL || 'gemini-3.5-flash' });
}
