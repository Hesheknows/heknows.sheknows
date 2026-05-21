// netlify/functions/get-advisors.js
exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  };

  const SUPABASE_URL = 'https://ydqcxbwxfzyxdzidafch.supabase.co';
  const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY;

  try {
    const advRes = await fetch(`${SUPABASE_URL}/rest/v1/advisor_profiles?select=id,specialty,price_per_session,available,bio`, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    });
    const advProfiles = await advRes.json();

    if (!advProfiles || !Array.isArray(advProfiles) || advProfiles.length === 0) {
      return { statusCode: 200, headers, body: JSON.stringify([]) };
    }

    const ids = advProfiles.map(a => a.id).join(',');
    const profilesRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=in.(${ids})&select=id,full_name,avatar_url,bio`, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    });
    const profiles = await profilesRes.json();

    const combined = advProfiles.map(adv => {
      const profile = Array.isArray(profiles) ? profiles.find(p => p.id === adv.id) : {};
      return {
        id: adv.id,
        full_name: profile?.full_name || 'Advisor',
        avatar_url: profile?.avatar_url || null,
        bio: adv.bio || profile?.bio || '',
        adv: {
          specialty: adv.specialty,
          price_per_session: adv.price_per_session,
          available: adv.available,
          bio: adv.bio || profile?.bio || ''
        }
      };
    });

    return { statusCode: 200, headers, body: JSON.stringify(combined) };
  } catch (err) {
    return { statusCode: 200, headers, body: JSON.stringify({ error: err.message }) };
  }
};
