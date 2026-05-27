// netlify/functions/create-review.js
//
// Guarda la reseña de una consulta.
// Valida que:
//  - El usuario sea dueño de la consulta
//  - La consulta exista y haya sido pagada
//  - No exista ya una reseña para esta consulta
//
// Body esperado:
//   { access_token, consultation_id, stars, would_recommend, comment, is_public, is_anonymous }

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
    const body = JSON.parse(event.body || '{}');
    const {
      access_token,
      consultation_id,
      stars,
      would_recommend,
      comment,
      is_public,
      is_anonymous
    } = body;

    // 1. Validaciones básicas
    if (!access_token || !consultation_id || !stars) {
      return resp(200, { error: 'Faltan datos: access_token, consultation_id y stars son requeridos' });
    }

    const starsNum = parseInt(stars);
    if (isNaN(starsNum) || starsNum < 1 || starsNum > 5) {
      return resp(200, { error: 'Las estrellas deben ser un número entre 1 y 5' });
    }

    // 2. Validar token del usuario
    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${access_token}`
      }
    });
    if (!userRes.ok) {
      return resp(200, { error: 'Sesión inválida' });
    }
    const user = await userRes.json();
    const userId = user.id;

    // 3. Verificar que la consulta exista y pertenezca al usuario
    const consRes = await fetch(
      `${SUPABASE_URL}/rest/v1/consultations?id=eq.${consultation_id}&select=id,user_id,advisor_id,status,paid_at`,
      { headers: sbHeaders(SUPABASE_KEY) }
    );
    const cons = await consRes.json();
    if (!Array.isArray(cons) || cons.length === 0) {
      return resp(200, { error: 'Consulta no encontrada' });
    }

    const consultation = cons[0];
    if (consultation.user_id !== userId) {
      return resp(200, { error: 'No puedes reseñar una consulta que no es tuya' });
    }

    if (!consultation.paid_at) {
      return resp(200, { error: 'Solo puedes reseñar consultas que ya hayan sido pagadas' });
    }

    // 4. Verificar que no exista ya una reseña para esta consulta
    const existsRes = await fetch(
      `${SUPABASE_URL}/rest/v1/reviews?consultation_id=eq.${consultation_id}&select=id`,
      { headers: sbHeaders(SUPABASE_KEY) }
    );
    const existing = await existsRes.json();
    if (Array.isArray(existing) && existing.length > 0) {
      return resp(200, { error: 'Ya dejaste una reseña para esta consulta' });
    }

    // 5. Insertar la reseña
    const payload = {
      consultation_id,
      user_id: userId,
      advisor_id: consultation.advisor_id,
      stars: starsNum,
      would_recommend: typeof would_recommend === 'boolean' ? would_recommend : null,
      comment: comment ? String(comment).trim().slice(0, 1000) : null,
      is_public: is_public !== false,        // default: true
      is_anonymous: is_anonymous === true    // default: false
    };

    const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/reviews`, {
      method: 'POST',
      headers: {
        ...sbHeaders(SUPABASE_KEY),
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(payload)
    });

    if (!insertRes.ok) {
      const errText = await insertRes.text();
      console.error('Insert review error:', errText);
      return resp(200, { error: 'No se pudo guardar la reseña' });
    }

    const review = await insertRes.json();
    console.log(`✅ Reseña creada para consulta ${consultation_id}, ${starsNum} estrellas`);

    return resp(200, {
      success: true,
      review: Array.isArray(review) ? review[0] : review
    });

  } catch (err) {
    console.error('create-review error:', err);
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
