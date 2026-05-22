// netlify/functions/create-reply.js
exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json(200, {});
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method Not Allowed' });

  let body;
  try { body = JSON.parse(event.body); }
  catch { return json(400, { error: 'JSON invalido' }); }

  const { token, post_id, text, is_anonymous = false } = body;
  if (!token || !post_id || !text?.trim()) return json(400, { error: 'Faltan campos' });

  const SUPA_URL = 'https://ydqcxbwxfzyxdzidafch.supabase.co';
  const SERVICE_KEY = process.env.SUPABASE_SECRET_KEY;
  const ANON_KEY = 'sb_publishable_6LRVFCwHqtf0r9daHpqbLg_oH9VTpRA';

  // Verificar token
  const userRes = await fetch(`${SUPA_URL}/auth/v1/user`, {
    headers: { 'Authorization': `Bearer ${token}`, 'apikey': ANON_KEY }
  });
  if (!userRes.ok) return json(401, { error: 'Token invalido o expirado' });
  const { id: userId } = await userRes.json();

  try {
    const replyRes = await fetch(`${SUPA_URL}/rest/v1/post_replies`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'apikey': SERVICE_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        post_id,
        user_id: userId,
        body: text.trim(),
        is_anonymous
      })
    });

    if (!replyRes.ok) {
      const t = await replyRes.text();
      console.error('Error creando reply:', replyRes.status, t);
      return json(500, { error: 'Error al responder: ' + t });
    }

    const [reply] = await replyRes.json();

    // Incrementar likes no, pero si actualizar updated_at del post
    await fetch(`${SUPA_URL}/rest/v1/posts?id=eq.${post_id}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'apikey': SERVICE_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ updated_at: new Date().toISOString() })
    });

    return json(200, { reply });
  } catch (err) {
    console.error('create-reply error:', err);
    return json(500, { error: err.message });
  }
};

const json = (s, d) => ({
  statusCode: s,
  headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  body: JSON.stringify(d)
});
