// netlify/functions/get-pending-reviews.js
//
// Devuelve las consultas del usuario que YA EXPIRARON (>=24h) y aún no
// tienen reseña. Esto es lo que usamos para mostrar el modal "califica a [advisor]".
//
// Body esperado: { access_token }
// Devuelve: { pending: [{ consultation_id, advisor_id, advisor_name, advisor_avatar }, ...] }

const SUPABASE_URL = 'https://ydqcxbwxfzyxdzidafch.supabase.co';

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY;
  if (!SUPABASE_KEY) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server misconfigured' }) };
  }

  try {
    const { access_token } = JSON.parse(event.body || '{}');
    if (!access_token) {
      return resp(200, { error: 'Falta access_token' });
    }

    // 1. Validar usuario
    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${access_token}`
      }
    });
    if (!userRes.ok) return resp(200, { error: 'Sesión inválida' });
    const user = await userRes.json();

    // 2. Buscar consultas del usuario que YA expiraron y fueron pagadas
    const nowIso = new Date().toISOString();
    const consRes = await fetch(
      `${SUPABASE_URL}/rest/v1/consultations?user_id=eq.${user.id}&paid_at=not.is.null&expires_at=lt.${nowIso}&select=id,advisor_id,expires_at&order=expires_at.desc`,
      { headers: sbHeaders(SUPABASE_KEY) }
    );
    const consultations = await consRes.json();

    if (!Array.isArray(consultations) || consultations.length === 0) {
      return resp(200, { pending: [] });
    }

    // 3. De esas, quitar las que YA tienen reseña
    const consultationIds = consultations.map(c => `"${c.id}"`).join(',');
    const reviewsRes = await fetch(
      `${SUPABASE_URL}/rest/v1/reviews?consultation_id=in.(${consultationIds})&select=consultation_id`,
      { headers: sbHeaders(SUPABASE_KEY) }
    );
    const existingReviews = await reviewsRes.json();
    const reviewedSet = new Set(
      Array.isArray(existingReviews) ? existingReviews.map(r => r.consultation_id) : []
    );

    const pending = consultations.filter(c => !reviewedSet.has(c.id));
    if (pending.length === 0) {
      return resp(200, { pending: [] });
    }

    // 4. Cargar info de los advisors
    const advisorIds = [...new Set(pending.map(c => `"${c.advisor_id}"`))].join(',');
    const profRes = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=in.(${advisorIds})&select=id,full_name,avatar_url`,
      { headers: sbHeaders(SUPABASE_KEY) }
    );
    const profs = await profRes.json();
    const profMap = {};
    if (Array.isArray(profs)) profs.forEach(p => { profMap[p.id] = p; });

    // 5. Armar respuesta
    const result = pending.map(c => ({
      consultation_id: c.id,
      advisor_id: c.advisor_id,
      advisor_name: profMap[c.advisor_id]?.full_name || 'Advisor',
      advisor_avatar: profMap[c.advisor_id]?.avatar_url || null,
      expired_at: c.expires_at
    }));

    return resp(200, { pending: result });

  } catch (err) {
    console.error('get-pending-reviews error:', err);
    return resp(200, { error: 'Error: ' + err.message });
  }

  function resp(status, data) {
    return { statusCode: status, headers, body: JSON.stringify(data) };
  }
};

function sbHeaders(key) {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`
  };
}
