// netlify/functions/get-profile.js
// Devuelve los datos del usuario autenticado: profiles + advisor_profiles (si aplica)

const json = (statusCode, data) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  },
  body: JSON.stringify(data)
});

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json(200, { ok: true });
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method Not Allowed' });

  const SUPABASE_URL = 'https://ydqcxbwxfzyxdzidafch.supabase.co';
  const SERVICE_KEY = process.env.SUPABASE_SECRET_KEY;
  const ANON_KEY = 'sb_publishable_6LRVFCwHqtf0r9daHpqbLg_oH9VTpRA';

  if (!SERVICE_KEY) {
    console.error('SUPABASE_SECRET_KEY no configurada');
    return json(500, { error: 'Error de configuración' });
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return json(400, { error: 'JSON inválido' }); }

  const { token } = body;
  if (!token) return json(400, { error: 'Token requerido' });

  // 1. Verificar usuario
  let userId;
  try {
    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: ANON_KEY }
    });
    if (!userRes.ok) return json(401, { error: 'Token inválido' });
    const userData = await userRes.json();
    if (!userData.id) return json(401, { error: 'Usuario no encontrado' });
    userId = userData.id;
  } catch (e) {
    console.error('Auth error:', e.message);
    return json(500, { error: 'Error verificando usuario' });
  }

  // 2. Leer profile
  let profile = null;
  try {
    const pRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=*`, {
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`
      }
    });
    if (pRes.ok) {
      const arr = await pRes.json();
      profile = Array.isArray(arr) && arr.length ? arr[0] : null;
    }
  } catch (e) {
    console.error('Error leyendo profile:', e.message);
  }

  // 3. Leer advisor_profile si aplica
  let advisor_profile = null;
  if (profile && profile.role === 'advisor') {
    try {
      const aRes = await fetch(`${SUPABASE_URL}/rest/v1/advisor_profiles?id=eq.${userId}&select=*`, {
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`
        }
      });
      if (aRes.ok) {
        const arr = await aRes.json();
        advisor_profile = Array.isArray(arr) && arr.length ? arr[0] : null;
      }
    } catch (e) {
      console.error('Error leyendo advisor_profile:', e.message);
    }
  }

  return json(200, {
    ok: true,
    profile: profile || {},
    advisor_profile: advisor_profile
  });
};
