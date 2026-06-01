// netlify/functions/get-public-profile.js
// Devuelve SOLO campos públicos de un perfil (nombre, foto, plan).
// NUNCA devuelve correo ni datos sensibles.
// Verifica el token de quien pide (debe estar logueado).
// Reemplaza las lecturas directas a la tabla `profiles` con la llave pública.

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: cors(), body: JSON.stringify({ ok: true }) };
  }
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method Not Allowed' });

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return json(400, { error: 'JSON inválido' }); }

  const { token, profileId } = body;
  if (!token) return json(400, { error: 'Token requerido' });

  const SUPA_URL = 'https://ydqcxbwxfzyxdzidafch.supabase.co';
  const SERVICE_KEY = process.env.SUPABASE_SECRET_KEY;
  const ANON_KEY = 'sb_publishable_6LRVFCwHqtf0r9daHpqbLg_oH9VTpRA';

  if (!SERVICE_KEY) {
    console.error('SUPABASE_SECRET_KEY no está seteada');
    return json(500, { error: 'Configuración del servidor incompleta' });
  }

  // 1. Verificar que quien pide esté logueado (token válido)
  let requesterId;
  try {
    const userRes = await fetch(`${SUPA_URL}/auth/v1/user`, {
      headers: { 'Authorization': `Bearer ${token}`, 'apikey': ANON_KEY }
    });
    if (!userRes.ok) return json(401, { error: 'Token inválido o expirado' });
    const userData = await userRes.json();
    requesterId = userData.id;
    if (!requesterId) return json(401, { error: 'No se pudo identificar al usuario' });
  } catch (e) {
    console.error('Auth error:', e.message);
    return json(500, { error: 'Error verificando usuario' });
  }

  // 2. Si no mandan profileId, devolver el perfil del propio usuario (incluye su plan)
  const targetId = profileId || requesterId;

  // 3. Leer SOLO campos públicos con la llave secreta
  try {
    const profRes = await fetch(
      `${SUPA_URL}/rest/v1/profiles?id=eq.${targetId}&select=id,full_name,avatar_url,plan,role`,
      { headers: { 'Authorization': `Bearer ${SERVICE_KEY}`, 'apikey': SERVICE_KEY } }
    );
    if (!profRes.ok) {
      const t = await profRes.text();
      console.error('Error leyendo profile:', profRes.status, t);
      return json(500, { error: 'Error leyendo perfil' });
    }
    const arr = await profRes.json();
    const prof = Array.isArray(arr) && arr.length ? arr[0] : null;

    if (!prof) return json(404, { error: 'Perfil no encontrado' });

    // Devolver solo lo público (nunca el email)
    return json(200, {
      profile: {
        id: prof.id,
        full_name: prof.full_name || null,
        avatar_url: prof.avatar_url || null,
        plan: prof.plan || 'free',
        role: prof.role || 'user'
      }
    });
  } catch (err) {
    console.error('get-public-profile catch:', err.message);
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
