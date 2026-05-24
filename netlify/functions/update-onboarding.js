// netlify/functions/update-onboarding.js
//
// Guarda el rol y completa el onboarding del usuario de forma segura.
// La SERVICE_KEY vive aquí en el servidor (env var), NUNCA en el browser.
//
// POST body: { token, role, plan }

const SUPABASE_URL = 'https://ydqcxbwxfzyxdzidafch.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SECRET_KEY;
const ANON_KEY = 'sb_publishable_6LRVFCwHqtf0r9daHpqbLg_oH9VTpRA';

exports.handler = async (event) => {
  // CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders(), body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method Not Allowed' });
  }

  // Diagnóstico: verificar que SERVICE_KEY existe
  if (!SERVICE_KEY) {
    return json(500, { error: 'SUPABASE_SECRET_KEY no está configurada en Netlify' });
  }

  let body;
  try { body = JSON.parse(event.body); }
  catch { return json(400, { error: 'JSON inválido' }); }

  const { token, role, plan } = body;
  if (!token) return json(400, { error: 'Falta token' });
  if (!role || !['user', 'advisor'].includes(role)) {
    return json(400, { error: 'Rol inválido' });
  }

  // 1. Verificar el token y obtener el ID del usuario
  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: ANON_KEY }
  });
  if (!userRes.ok) return json(401, { error: 'No autorizado' });
  const userData = await userRes.json();
  if (!userData.id) return json(401, { error: 'Usuario no encontrado' });

  // 2. Actualizar profiles con SERVICE_KEY desde el servidor (no expuesta)
  try {
    const updateRes = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${userData.id}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${SERVICE_KEY}`,
          apikey: SERVICE_KEY,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({
          role,
          plan: plan || 'free',
          onboarding_done: true,
        }),
      }
    );

    if (!updateRes.ok) {
      const errText = await updateRes.text();
      console.error('Supabase update failed:', errText);
      return json(500, { error: 'No pude guardar tu onboarding' });
    }

    return json(200, { ok: true, role, plan: plan || 'free' });
  } catch (err) {
    console.error('update-onboarding error:', err);
    return json(500, { error: err.message });
  }
};

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

function json(s, d) {
  return {
    statusCode: s,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
    body: JSON.stringify(d),
  };
}
