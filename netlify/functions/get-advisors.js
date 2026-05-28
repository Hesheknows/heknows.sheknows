// netlify/functions/get-advisors.js
// v2: filtra advisors sin foto de perfil (no aparecen públicamente)
exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  };
  const SUPABASE_URL = 'https://ydqcxbwxfzyxdzidafch.supabase.co';
  const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY;
  try {
    const advRes = await fetch(`${SUPABASE_URL}/rest/v1/advisor_profiles?select=id,specialty,price_per_session,available,bio,rating_average,rating_count`, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    });
    const advRaw = await advRes.text();
    console.log('advisor_profiles response:', advRaw);
    const advProfiles = JSON.parse(advRaw);
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
          bio: adv.bio || profile?.bio || '',
          rating_average: adv.rating_average || 0,
          rating_count: adv.rating_count || 0
        }
      };
    });

    // 🆕 FILTRO: solo mostrar advisors que tengan foto de perfil
    // (calidad mínima del marketplace — sin foto no aparece públicamente)
    const visibles = combined.filter(a =>
      a.avatar_url && typeof a.avatar_url === 'string' && a.avatar_url.trim() !== ''
    );
    console.log(`get-advisors: ${combined.length} totales, ${visibles.length} con foto`);

    return { statusCode: 200, headers, body: JSON.stringify(visibles) };
  } catch (err) {
    console.log('Error:', err.message);
    return { statusCode: 200, headers, body: JSON.stringify({ error: err.message }) };
  }
};
