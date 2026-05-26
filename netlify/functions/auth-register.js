// netlify/functions/auth-register.js
// v4: ADVISOR se crea INACTIVO (available=false). Solo se activa cuando paga Stripe.

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

  // 2. Obtener user.id
  let userId = supabaseData.user?.id || supabaseData.id;

  if (!userId) {
    try {
      const lookupRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?email=${encodeURIComponent(email)}`, {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`
        }
      });
      if (lookupRes.ok) {
        const lookupData = await lookupRes.json();
        const users = Array.isArray(lookupData) ? lookupData : (lookupData.users || []);
        const found = users.find(u => u.email === email);
        if (found) userId = found.id;
      }
    } catch(e) {
      console.error('Error buscando user por email:', e.message);
    }
  }

  if (!userId) {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        error: 'No se pudo obtener el ID del usuario después del registro',
        raw: supabaseData
      })
    };
  }

  // 3. Crear/actualizar row en profiles
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
  }

  // 4. Si es advisor, crear row en advisor_profiles INACTIVO
  let advisor_created = false;
  let advisor_error = null;
  if (role === 'advisor') {
    const advisorBody = {
      id: userId,
      bio: bio || null,
      specialty: specialty || null,
      price_per_session: parseFloat(price_per_session) || 100,
      available: false,        // ⚠️ INACTIVO hasta que pague Stripe
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
        advisor_error = await advRes.text().catch(() => 'unknown error');
        console.error('Error creando advisor_profile:', advRes.status, advisor_error);
      }
    } catch(e) {
      advisor_error = e.message;
      console.error('Error creando advisor_profile:', e.message);
    }
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      success: true,
      user_id: userId,
      access_token: supabaseData.session?.access_token || supabaseData.access_token || null,
      refresh_token: supabaseData.session?.refresh_token || supabaseData.refresh_token || null,
      user: supabaseData.user || { id: userId, email },
      email_confirmation_required: !supabaseData.session && !supabaseData.access_token,
      advisor_created,
      advisor_error,
      requires_payment: role === 'advisor'  // bandera para que frontend redirija a Stripe
    })
  };
};
