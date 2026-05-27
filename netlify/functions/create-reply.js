// netlify/functions/create-reply.js
// FIX: usar SERVICE_KEY para validar token (la anon_key no tiene permisos para verificar tokens de otros usuarios)

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

  if (!SERVICE_KEY) {
    console.error('SUPABASE_SECRET_KEY no está configurada');
    return json(500, { error: 'Server misconfigured' });
  }

  // Verificar token usando SERVICE_KEY como apikey (no la anon_key)
  const userRes = await fetch(`${SUPA_URL}/auth/v1/user`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'apikey': SERVICE_KEY
    }
  });

  if (!userRes.ok) {
    const errText = await userRes.text();
    console.error('Token validation failed:', userRes.status, errText);
    return json(401, { error: 'Token invalido o expirado' });
  }

  const userData = await userRes.json();
  const userId = userData.id;

  if (!userId) {
    return json(401, { error: 'Usuario no encontrado' });
  }

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

    // Actualizar updated_at del post
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
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  },
  body: JSON.stringify(d)
});
