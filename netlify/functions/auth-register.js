// netlify/functions/auth-register.js
// Si role='advisor', además de crear el usuario crea profiles y advisor_profiles
// inmediatamente usando service_role (no depende de email confirmation)

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  const SUPABASE_URL = 'https://ydqcxbwxfzyxdzidafch.supabase.co';
  const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY;

  if (!SUPABASE_KEY) {
    return { statusCode: 200, headers, body: JSON.stringify({ error: 'Falta SUPABASE_SECRET_KEY en env' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch(e) {
    return { statusCode: 200, headers, body: JSON.stringify({ error: 'Body inválido: ' + e.message }) };
  }

  const {
    email, password,
    full_name, gender, role,
    bio, specialty, price_per_session, civil_status, years_together
  } = body;

  if (!email || !password) {
    return { statusCode: 200, headers, body: JSON.stringify({ error: 'Falta email o contraseña' }) };
  }

  // 1. Registrar usuario en Supabase Auth
  let supabaseRes, supabaseData;
  try {
    supabaseRes = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      },
      body: JSON.stringify({ email, password })
    });
    supabaseData = await supabaseRes.json();
  } catch(e) {
    return { statusCode: 200, headers, body: JSON.stringify({ error: 'Error conectando con Supabase: ' + e.message }) };
  }

  if (supabaseData.error || supabaseData.error_description || supabaseData.msg) {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        error: supabaseData.error_description || supabaseData.msg || supabaseData.error,
        supabase_status: supabaseRes.status,
        raw: supabaseData
      })
    };
  }

  const userId = supabaseData.user?.id;
  if (!userId) {
    return { statusCode: 200, headers, body: JSON.stringify({ error: 'Usuario creado pero sin id', raw: supabaseData }) };
  }

  // 2. Crear/actualizar row en profiles
  const profileBody = {
    id: userId,
    email,
    full_name: full_name || null,
    gender: gender || null,
    role: role || 'user'
  };

  try {
    await fetch(`${SUPABASE_URL}/rest/v1/profiles`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Prefer': 'resolution=merge-duplicates,return=minimal'
      },
      body: JSON.stringify(profileBody)
    });
  } catch(e) {
    console.error('Error creando profile:', e.message);
    // No fallar el registro completo si profiles falla
  }

  // 3. Si es advisor, crear row en advisor_profiles
  let advisor_created = false;
  if (role === 'advisor') {
    const advisorBody = {
      id: userId,
      bio: bio || null,
      specialty: specialty || null,
      price_per_session: parseFloat(price_per_session) || 100,
      available: true,
      civil_status: civil_status || null,
      years_together: parseInt(years_together) || 0,
      commission_rate: 0.70
    };

    try {
      const advRes = await fetch(`${SUPABASE_URL}/rest/v1/advisor_profiles`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Prefer': 'resolution=merge-duplicates,return=minimal'
        },
        body: JSON.stringify(advisorBody)
      });
      advisor_created = advRes.ok;
      if (!advRes.ok) {
        const errText = await advRes.text().catch(() => '');
        console.error('Error creando advisor_profile:', advRes.status, errText);
      }
    } catch(e) {
      console.error('Error creando advisor_profile:', e.message);
    }
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      success: true,
      access_token: supabaseData.session?.access_token || supabaseData.access_token || null,
      refresh_token: supabaseData.session?.refresh_token || supabaseData.refresh_token || null,
      user: supabaseData.user,
      email_confirmation_required: !supabaseData.session && !supabaseData.access_token,
      advisor_created
    })
  };
};
