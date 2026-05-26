// netlify/functions/save-advisor.js
// Guarda/actualiza el perfil de advisor del usuario autenticado

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
  // CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return json(200, { ok: true });
  }

  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }

  const SUPABASE_URL = 'https://ydqcxbwxfzyxdzidafch.supabase.co';
  const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY;
  const ANON_KEY = 'sb_publishable_6LRVFCwHqtf0r9daHpqbLg_oH9VTpRA';

  if (!SUPABASE_KEY) {
    console.error('SUPABASE_SECRET_KEY no está configurada en Netlify');
    return json(500, { error: 'Error de configuración del servidor' });
  }

  // 1. Parsear body
  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (e) {
    return json(400, { error: 'JSON inválido' });
  }

  const { token, specialty, price_per_session, bio, civil_status, years_together } = body;

  if (!token) {
    return json(400, { error: 'Token requerido' });
  }

  if (!specialty || !specialty.trim()) {
    return json(400, { error: 'Especialidad requerida' });
  }

  // 2. Verificar usuario con el token
  let userId;
  try {
    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'apikey': ANON_KEY
      }
    });

    if (!userRes.ok) {
      const errText = await userRes.text();
      console.error('Auth falló:', userRes.status, errText);
      return json(401, { error: 'Token inválido o expirado' });
    }

    const userData = await userRes.json();
    if (!userData || !userData.id) {
      return json(401, { error: 'Usuario no encontrado' });
    }
    userId = userData.id;
  } catch (e) {
    console.error('Error al verificar usuario:', e.message);
    return json(500, { error: 'Error al verificar usuario' });
  }

  // 3. Preparar datos del advisor (INCLUYENDO BIO ESTA VEZ)
  const advisorData = {
    id: userId,
    specialty: specialty.trim(),
    price_per_session: parseInt(price_per_session) || 100,
    bio: bio ? bio.trim() : null,
    civil_status: civil_status || null,
    years_together: years_together ? parseInt(years_together) : null,
    available: true,
    commission_rate: 0.70,
    updated_at: new Date().toISOString()
  };

  // 4. Upsert en advisor_profiles
  let upsertResponse;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/advisor_profiles`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates,return=representation'
      },
      body: JSON.stringify(advisorData)
    });

    const responseText = await res.text();
    console.log('Upsert advisor_profiles status:', res.status);
    console.log('Upsert advisor_profiles response:', responseText);

    if (!res.ok) {
      let errMsg = 'Error guardando advisor';
      try {
        const parsed = JSON.parse(responseText);
        errMsg = parsed.message || parsed.error || parsed.hint || errMsg;
      } catch {}
      return json(res.status, { error: errMsg, details: responseText });
    }

    try {
      upsertResponse = JSON.parse(responseText);
    } catch {
      upsertResponse = null;
    }
  } catch (e) {
    console.error('Error en upsert:', e.message);
    return json(500, { error: 'Error de red al guardar advisor' });
  }

  // 5. Actualizar rol en profiles a 'advisor'
  try {
    const profileRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`, {
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({ role: 'advisor' })
    });

    if (!profileRes.ok) {
      const profErrText = await profileRes.text();
      console.error('Error actualizando role en profiles:', profileRes.status, profErrText);
      // No fallar — el advisor ya se guardó, solo loguear
    }
  } catch (e) {
    console.error('Error al actualizar role:', e.message);
    // No fallar — el advisor ya se guardó
  }

  return json(200, {
    ok: true,
    success: true,
    advisor: Array.isArray(upsertResponse) ? upsertResponse[0] : upsertResponse
  });
};
