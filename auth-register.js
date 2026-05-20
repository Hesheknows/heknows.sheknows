// netlify/functions/auth-register.js

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const SUPABASE_URL = 'https://ydqcxbwxfzyxdzidafch.supabase.co';
  // ⚠️ REEMPLAZA ESTA KEY con la "anon public" de Supabase → Settings → API
  const SUPABASE_KEY = 'sb_publishable_6LRVFCwHqtf0r9daHpqbLg_oH9VTpRA';

  try {
    const { email, password } = JSON.parse(event.body);

    if (!email || !password) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'Email y contraseña son requeridos' })
      };
    }

    // 1. Crear usuario en Supabase Auth
    const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();

    // Log para debug en Netlify Functions logs
    console.log('Supabase signup response:', res.status, JSON.stringify(data));

    // Supabase devuelve error así: { error: "...", error_description: "..." }
    // O así: { code: 400, msg: "..." }
    if (!res.ok || data.error || data.msg) {
      const errorMsg = data.error_description || data.msg || data.error || 'Error al crear cuenta';
      return {
        statusCode: res.status || 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: errorMsg, raw: data })
      };
    }

    // 2. Crear perfil en tabla profiles (si el usuario fue creado)
    if (data.user?.id) {
      const profileRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({
          id: data.user.id,
          email: email.toLowerCase(),
          created_at: new Date().toISOString()
        })
      });
      if (!profileRes.ok) {
        const profileErr = await profileRes.text();
        console.warn('Profile insert warning:', profileErr);
        // No es fatal — continuamos
      }
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        success: true,
        user: data.user,
        // Si email confirmation está OFF, habrá session. Si está ON, será null.
        access_token: data.session?.access_token || data.access_token || null,
        refresh_token: data.session?.refresh_token || data.refresh_token || null,
        email_confirmation_required: !data.session && !data.access_token
      })
    };

  } catch (err) {
    console.error('auth-register error:', err);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message })
    };
  }
};
