// netlify/functions/save-advisor.js

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  };

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const SUPABASE_URL = 'https://ydqcxbwxfzyxdzidafch.supabase.co';
  const SUPABASE_KEY = 'sb_secret_-rYCDZ5-BMzP13bDqvJtTg_FmtYp-7E';

  try {
    const { userId, specialty, price_per_session, bio, civil_status, years_together, available } = JSON.parse(event.body);

    if (!userId) {
      return { statusCode: 200, headers, body: JSON.stringify({ error: 'Falta userId' }) };
    }

    const data = {
      id: userId,
      specialty,
      price_per_session: parseInt(price_per_session) || 0,
      civil_status: civil_status || null,
      years_together: years_together ? parseInt(years_together) : null,
      available: true,
      updated_at: new Date().toISOString()
    };

    // Usar upsert — inserta si no existe, actualiza si existe
    const res = await fetch(`${SUPABASE_URL}/rest/v1/advisor_profiles`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates,return=minimal'
      },
      body: JSON.stringify(data)
    });

    const resText = await res.text();
    console.log('Upsert advisor_profiles:', res.status, resText);

    if (!res.ok && res.status !== 200 && res.status !== 201) {
      return { statusCode: 200, headers, body: JSON.stringify({ error: 'Error guardando advisor: ' + resText }) };
    }

    // Actualizar rol en profiles
    await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`, {
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ role: 'advisor' })
    });

    return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };

  } catch (err) {
    console.error('save-advisor error:', err);
    return { statusCode: 200, headers, body: JSON.stringify({ error: err.message }) };
  }
};
