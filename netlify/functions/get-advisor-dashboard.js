// netlify/functions/get-advisor-dashboard.js
// Devuelve los números del panel del advisor:
// consultas activas, ganado este mes, comisión actual, reseña promedio.
// Verifica el token; solo devuelve datos del propio advisor.

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: cors(), body: JSON.stringify({ ok: true }) };
  }
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method Not Allowed' });

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return json(400, { error: 'JSON inválido' }); }

  const { token } = body;
  if (!token) return json(400, { error: 'Token requerido' });

  const SUPA_URL = 'https://ydqcxbwxfzyxdzidafch.supabase.co';
  const SERVICE_KEY = process.env.SUPABASE_SECRET_KEY;
  const ANON_KEY = 'sb_publishable_6LRVFCwHqtf0r9daHpqbLg_oH9VTpRA';

  if (!SERVICE_KEY) {
    console.error('SUPABASE_SECRET_KEY no está seteada');
    return json(500, { error: 'Configuración del servidor incompleta' });
  }

  // 1. Verificar token y obtener el id del advisor
  let advisorId;
  try {
    const userRes = await fetch(`${SUPA_URL}/auth/v1/user`, {
      headers: { 'Authorization': `Bearer ${token}`, 'apikey': ANON_KEY }
    });
    if (!userRes.ok) return json(401, { error: 'Token inválido o expirado' });
    const userData = await userRes.json();
    advisorId = userData.id;
    if (!advisorId) return json(401, { error: 'No se pudo identificar al usuario' });
  } catch (e) {
    console.error('Auth error:', e.message);
    return json(500, { error: 'Error verificando usuario' });
  }

  const adminHeaders = {
    'Authorization': `Bearer ${SERVICE_KEY}`,
    'apikey': SERVICE_KEY
  };

  try {
    // 2. Datos del perfil de advisor (comisión, reseña, y campos para completitud)
    let commission = 0.70;
    let ratingAvg = null;
    let ratingCount = 0;
    let apBio = null, apPrice = null, apSpecialty = null;
    const apRes = await fetch(
      `${SUPA_URL}/rest/v1/advisor_profiles?id=eq.${advisorId}&select=commission_rate,rating_average,rating_count,bio,price_per_session,specialty`,
      { headers: adminHeaders }
    );
    if (apRes.ok) {
      const apArr = await apRes.json();
      if (Array.isArray(apArr) && apArr.length) {
        commission = Number(apArr[0].commission_rate) || 0.70;
        ratingAvg = apArr[0].rating_average != null ? Number(apArr[0].rating_average) : null;
        ratingCount = Number(apArr[0].rating_count) || 0;
        apBio = apArr[0].bio;
        apPrice = apArr[0].price_per_session;
        apSpecialty = apArr[0].specialty;
      }
    }

    // 2b. Avatar y bio del perfil base (la foto vive en profiles)
    let avatarUrl = null, profileBio = null;
    const pRes = await fetch(
      `${SUPA_URL}/rest/v1/profiles?id=eq.${advisorId}&select=avatar_url,bio`,
      { headers: adminHeaders }
    );
    if (pRes.ok) {
      const pArr = await pRes.json();
      if (Array.isArray(pArr) && pArr.length) {
        avatarUrl = pArr[0].avatar_url;
        profileBio = pArr[0].bio;
      }
    }

    // Calcular qué le falta al perfil para aparecer en Advisors
    const faltantes = [];
    if (!avatarUrl) faltantes.push('foto');
    // bio puede estar en cualquiera de las dos tablas
    if ((!apBio || apBio.trim() === '') && (!profileBio || profileBio.trim() === '')) faltantes.push('bio');
    if (!apPrice || Number(apPrice) <= 0) faltantes.push('precio');
    if (!apSpecialty || apSpecialty.trim() === '') faltantes.push('especialidad');

    // 3. Consultas del advisor (pagadas)
    const consRes = await fetch(
      `${SUPA_URL}/rest/v1/consultations?advisor_id=eq.${advisorId}&status=eq.paid&select=advisor_amount,paid_at,expires_at`,
      { headers: adminHeaders }
    );
    let activas = 0;
    let ganadoMes = 0;
    let totalConsultas = 0;
    if (consRes.ok) {
      const cons = await consRes.json();
      if (Array.isArray(cons)) {
        totalConsultas = cons.length;
        const ahora = new Date();
        const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
        cons.forEach(c => {
          // Activa = no ha expirado todavía
          if (c.expires_at && new Date(c.expires_at) > ahora) {
            activas++;
          }
          // Ganado este mes = advisor_amount de las pagadas este mes
          if (c.paid_at && new Date(c.paid_at) >= inicioMes) {
            ganadoMes += Number(c.advisor_amount) || 0;
          }
        });
      }
    }

    return json(200, {
      consultas_activas: activas,
      ganado_mes: Math.round(ganadoMes),
      total_consultas: totalConsultas,
      comision_pct: Math.round(commission * 100),
      rating_average: ratingAvg,
      rating_count: ratingCount,
      perfil_completo: faltantes.length === 0,
      faltantes: faltantes
    });
  } catch (err) {
    console.error('get-advisor-dashboard catch:', err.message);
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
