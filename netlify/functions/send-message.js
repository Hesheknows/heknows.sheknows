// netlify/functions/send-message.js
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method Not Allowed' });
  let body;
  try { body = JSON.parse(event.body); }
  catch { return json(400, { error: 'JSON inválido' }); }
  const { token, conversationId, advisorId, body: msgBody } = body;
  if (!token || !msgBody?.trim()) return json(400, { error: 'Faltan campos' });

  const URL = 'https://ydqcxbwxfzyxdzidafch.supabase.co';
  const SERVICE_KEY = process.env.SUPABASE_SECRET_KEY;
  const ANON_KEY = 'sb_publishable_6LRVFCwHqtf0r9daHpqbLg_oH9VTpRA';

  // Verificar token con anon key
  const userRes = await fetch(`${URL}/auth/v1/user`, {
    headers: { 'Authorization': `Bearer ${token}`, 'apikey': ANON_KEY }
  });
  if (!userRes.ok) {
    const errText = await userRes.text();
    console.log('Auth error:', errText);
    return json(401, { error: 'No autorizado' });
  }
  const { id: userId } = await userRes.json();

  try {
    let convId = conversationId;
    if (!convId) {
      if (!advisorId) return json(400, { error: 'Se requiere advisorId' });
      const existing = await fetch(`${URL}/rest/v1/conversations?user_id=eq.${userId}&advisor_id=eq.${advisorId}&select=id`, {
        headers: { 'Authorization': `Bearer ${SERVICE_KEY}`, 'apikey': SERVICE_KEY }
      });
      const rows = await existing.json();
      if (rows.length > 0) {
        convId = rows[0].id;
      } else {
        const created = await fetch(`${URL}/rest/v1/conversations`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${SERVICE_KEY}`, 'apikey': SERVICE_KEY, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
          body: JSON.stringify({ user_id: userId, advisor_id: advisorId })
        });
        const [conv] = await created.json();
        convId = conv.id;
      }
    }
    const msgRes = await fetch(`${URL}/rest/v1/messages`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${SERVICE_KEY}`, 'apikey': SERVICE_KEY, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
      body: JSON.stringify({ conversation_id: convId, sender_id: userId, body: msgBody.trim() })
    });
    const [msg] = await msgRes.json();
    return json(200, { message: msg, conversationId: convId });
  } catch (err) {
    console.log('Error:', err.message);
    return json(500, { error: err.message });
  }
};
const json = (s, d) => ({ statusCode: s, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(d) });
