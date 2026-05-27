// netlify/functions/get-advisor-reviews.js
//
// Obtiene las reseñas PÚBLICAS de un advisor para mostrar en su perfil.
// Incluye el nombre del usuario que dejó la reseña (o "Anónimo" si así lo eligió).
//
// Query params: ?advisor_id=uuid
// Devuelve: { rating_average, rating_count, reviews: [...] }

const SUPABASE_URL = 'https://ydqcxbwxfzyxdzidafch.supabase.co';

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY;
  if (!SUPABASE_KEY) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server misconfigured' }) };
  }

  try {
    const advisorId = event.queryStringParameters?.advisor_id;
    if (!advisorId) {
      return resp(200, { error: 'Falta advisor_id' });
    }

    // 1. Promedio y cantidad de reseñas (desde advisor_profiles)
    const advRes = await fetch(
      `${SUPABASE_URL}/rest/v1/advisor_profiles?id=eq.${advisorId}&select=rating_average,rating_count`,
      { headers: sbHeaders(SUPABASE_KEY) }
    );
    const adv = await advRes.json();
    const ratingAverage = adv?.[0]?.rating_average || 0;
    const ratingCount   = adv?.[0]?.rating_count   || 0;

    // 2. Reseñas públicas (las más recientes primero)
    const revRes = await fetch(
      `${SUPABASE_URL}/rest/v1/reviews?advisor_id=eq.${advisorId}&is_public=eq.true&select=id,stars,would_recommend,comment,is_anonymous,created_at,user_id&order=created_at.desc&limit=20`,
      { headers: sbHeaders(SUPABASE_KEY) }
    );
    const reviews = await revRes.json();

    if (!Array.isArray(reviews)) {
      return resp(200, {
        rating_average: ratingAverage,
        rating_count: ratingCount,
        reviews: []
      });
    }

    // 3. Obtener nombres de usuarios que NO son anónimos (en un solo query)
    const userIds = reviews
      .filter(r => !r.is_anonymous)
      .map(r => r.user_id);

    let userMap = {};
    if (userIds.length > 0) {
      const idsParam = userIds.map(id => `"${id}"`).join(',');
      const profRes = await fetch(
        `${SUPABASE_URL}/rest/v1/profiles?id=in.(${idsParam})&select=id,full_name,avatar_url`,
        { headers: sbHeaders(SUPABASE_KEY) }
      );
      const profs = await profRes.json();
      if (Array.isArray(profs)) {
        profs.forEach(p => { userMap[p.id] = p; });
      }
    }

    // 4. Armar reseñas con nombre/avatar según anonimato
    const formatted = reviews.map(r => {
      const profile = r.is_anonymous ? null : userMap[r.user_id];
      return {
        id: r.id,
        stars: r.stars,
        would_recommend: r.would_recommend,
        comment: r.comment,
        created_at: r.created_at,
        is_anonymous: r.is_anonymous,
        user_name: r.is_anonymous ? 'Anónimo' : (profile?.full_name || 'Usuario'),
        user_avatar: r.is_anonymous ? null : (profile?.avatar_url || null)
      };
    });

    return resp(200, {
      rating_average: parseFloat(ratingAverage),
      rating_count: ratingCount,
      reviews: formatted
    });

  } catch (err) {
    console.error('get-advisor-reviews error:', err);
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
