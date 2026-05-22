// netlify/functions/create-post.js
exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json(200, {});
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method Not Allowed' });

  let body;
  try { body = JSON.parse(event.body); }
  catch { return json(400, { error: 'JSON invalido' }); }

  const { token, text, is_anonymous = true, category = 'general' } = body;
  if (!token || !text?.trim()) return json(400, { error: 'Faltan campos: token y texto' });

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
    const postRes = await fetch(`${SUPA_URL}/rest/v1/posts`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'apikey': SERVICE_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        user_id: userId,
        body: text.trim(),
        is_anonymous,
        category
      })
    });

    if (!postRes.ok) {
      const t = await postRes.text();
      console.error('Error creando post:', postRes.status, t);
      return json(500, { error: 'Error al publicar: ' + t });
    }

    const [post] = await postRes.json();
    return json(200, { post });
  } catch (err) {
    console.error('create-post error:', err);
    return json(500, { error: err.message });
  }
};

const json = (s, d) => ({
  statusCode: s,
  headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  body: JSON.stringify(d)
});
