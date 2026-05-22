// netlify/functions/get-messages.js
exports.handler = async (event) => {
  const { token, conversationId, markRead } = event.queryStringParameters || {};
  if (!token || !conversationId) return json(400, { error: 'Faltan parámetros' });

  const URL = 'https://ydqcxbwxfzyxdzidafch.supabase.co';
  const SERVICE_KEY = process.env.SUPABASE_SECRET_KEY;
  const ANON_KEY = 'sb_publishable_6LRVFCwHqtf0r9daHpqbLg_oH9VTpRA';

  const userRes = await fetch(`${URL}/auth/v1/user`, {
    headers: { 'Authorization': `Bearer ${token}`, 'apikey': ANON_KEY }
  });
  if (!userRes.ok) return json(401, { error: 'No autorizado' });
  const { id: userId } = await userRes.json();

  try {
    const msgsRes = await fetch(`${URL}/rest/v1/messages?conversation_id=eq.${conversationId}&order=created_at.asc&select=id,body,sender_id,created_at,read`, {
      headers: { 'Authorization': `Bearer ${SERVICE_KEY}`, 'apikey': SERVICE_KEY }
    });
    const messages = await msgsRes.json();

    if (markRead === 'true') {
      await fetch(`${URL}/rest/v1/rpc/mark_read`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${SERVICE_KEY}`, 'apikey': SERVICE_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_conversation_id: conversationId, p_reader_id: userId })
      });
    }
    return json(200, { messages, userId });
  } catch (err) {
    return json(500, { error: err.message });
  }
};
const json = (s, d) => ({ statusCode: s, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(d) });
