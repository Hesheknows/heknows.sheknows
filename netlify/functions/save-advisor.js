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

    // Upsert en advisor_profiles
    const advRes = await fetch(`${SUPABASE_URL}/rest/v1/advisor_profiles?id=eq.${userId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'apikey': SUPABASE_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({ specialty, price_per_session, bio, civil_status, years_together: years_together || null, available: true, updated_at: new Date().toISOString() })
    });

    // Si no existe el registro, hacer INSERT
    if (advRes.status === 404 || advRes.status === 200) {
      const checkRes = await fetch(`${SUPABASE_URL}/rest/v1/advisor_profiles?id=eq.${userId}&select=id`, {
        headers: { 'Authorization': `Bearer ${SUPABASE_KEY}`, 'apikey': SUPABASE_KEY }
      });
      const existing = await checkRes.json();
      
      if (!existing || existing.length === 0) {
        await fetch(`${SUPABASE_URL}/rest/v1/advisor_profiles`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'apikey': SUPABASE_KEY,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify({ id: userId, specialty, price_per_session, bio, civil_status, years_together: years_together || null, available: true })
        });
      }
    }

    // Actualizar rol en profiles
    await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'apikey': SUPABASE_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ role: 'advisor' })
    });

    return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };

  } catch (err) {
    return { statusCode: 200, headers, body: JSON.stringify({ error: err.message }) };
  }
};
