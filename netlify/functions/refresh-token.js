// netlify/functions/refresh-token.js
// Renueva el access_token usando el refresh_token (cuando el access_token expira).
// Devuelve { access_token, refresh_token } nuevos para guardar en hksk-session.

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: cors(), body: JSON.stringify({ ok: true }) };
  }
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method Not Allowed' });

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return json(400, { error: 'JSON inválido' }); }

  const { refresh_token } = body;
  if (!refresh_token) return json(400, { error: 'Falta refresh_token' });

  const SUPA_URL = 'https://ydqcxbwxfzyxdzidafch.supabase.co';
  const ANON_KEY = 'sb_publishable_6LRVFCwHqtf0r9daHpqbLg_oH9VTpRA';

  try {
    const res = await fetch(`${SUPA_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': ANON_KEY
      },
      body: JSON.stringify({ refresh_token })
    });

    if (!res.ok) {
      const t = await res.text();
      console.error('refresh-token failed:', res.status, t);
      return json(401, { error: 'No se pudo renovar la sesión' });
    }

    const data = await res.json();
    return json(200, {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      user: data.user || null
    });
  } catch (err) {
    console.error('refresh-token catch:', err.message);
    return json(500, { error: err.message });
  }
};

function cors() {
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };
}

const json = (s, d) => ({ statusCode: s, headers: cors(), body: JSON.stringify(d) });
