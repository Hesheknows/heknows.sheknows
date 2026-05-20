// netlify/functions/get-advisors.js

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  };

  const SUPABASE_URL = 'https://ydqcxbwxfzyxdzidafch.supabase.co';
  const SUPABASE_KEY = 'sb_secret_-rYCDZ5-BMzP13bDqvJtTg_FmtYp-7E';

  try {
    // Traer perfiles de advisors
    const profilesRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?role=eq.advisor&select=id,full_name,avatar_url,bio`, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    });
    const profiles = await profilesRes.json();

    if (!profiles || profiles.length === 0) {
      return { statusCode: 200, headers, body: JSON.stringify([]) };
    }

    // Traer advisor_profiles
    const ids = profiles.map(p => `"${p.id}"`).join(',');
    const advRes = await fetch(`${SUPABASE_URL}/rest/v1/advisor_profiles?id=in.(${ids})&select=id,specialty,price_per_session,available,bio`, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    });
    const advProfiles = await advRes.json();

    // Combinar
    const combined = profiles.map(p => ({
      ...p,
      adv: Array.isArray(advProfiles) ? (advProfiles.find(a => a.id === p.id) || {}) : {}
    }));

    return { statusCode: 200, headers, body: JSON.stringify(combined) };

  } catch (err) {
    return { statusCode: 200, headers, body: JSON.stringify({ error: err.message }) };
  }
};
