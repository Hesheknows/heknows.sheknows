// netlify/functions/get-advisors.js

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  };

  const SUPABASE_URL = 'https://ydqcxbwxfzyxdzidafch.supabase.co';
  const SUPABASE_KEY = 'sb_secret_-rYCDZ5-BMzP13bDqvJtTg_FmtYp-7E';

  try {
    // Traer advisor_profiles primero (con todos los datos)
    const advRes = await fetch(`${SUPABASE_URL}/rest/v1/advisor_profiles?available=eq.true&select=id,specialty,price_per_session,available`, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    });
    const advProfiles = await advRes.json();

    if (!advProfiles || !Array.isArray(advProfiles) || advProfiles.length === 0) {
      return { statusCode: 200, headers, body: JSON.stringify([]) };
    }

    // Traer perfiles de esos advisors
    const ids = advProfiles.map(a => a.id).join(',');
    const profilesRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=in.(${ids})&select=id,full_name,avatar_url,bio`, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    });
    const profiles = await profilesRes.json();

    // Combinar
    const combined = advProfiles.map(adv => {
      const profile = Array.isArray(profiles) ? profiles.find(p => p.id === adv.id) : {};
      return {
        id: adv.id,
        full_name: profile?.full_name || 'Advisor',
        avatar_url: profile?.avatar_url || null,
        bio: profile?.bio || '',
        adv: {
          specialty: adv.specialty,
          price_per_session: adv.price_per_session,
          available: adv.available
        }
      };
    });

    return { statusCode: 200, headers, body: JSON.stringify(combined) };

  } catch (err) {
    return { statusCode: 200, headers, body: JSON.stringify({ error: err.message }) };
  }
};
