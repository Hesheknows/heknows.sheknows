// netlify/functions/auth-register.js

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  };

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  const SUPABASE_URL = 'https://ydqcxbwxfzyxdzidafch.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_6LRVFCwHqtf0r9daHpqbLg_oH9VTpRA';

  let email, password;
  try {
    const body = JSON.parse(event.body);
    email = body.email;
    password = body.password;
  } catch(e) {
    return { statusCode: 200, headers, body: JSON.stringify({ error: 'Body inválido: ' + e.message }) };
  }

  if (!email || !password) {
    return { statusCode: 200, headers, body: JSON.stringify({ error: 'Falta email o contraseña' }) };
  }

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

  // Siempre regresamos 200 para que el browser muestre el error real
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

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      success: true,
      access_token: supabaseData.session?.access_token || supabaseData.access_token || null,
      refresh_token: supabaseData.session?.refresh_token || supabaseData.refresh_token || null,
      user: supabaseData.user,
      email_confirmation_required: !supabaseData.session && !supabaseData.access_token
    })
  };
};
