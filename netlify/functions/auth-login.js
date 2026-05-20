// netlify/functions/auth-login.js

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const SUPABASE_URL = 'https://ydqcxbwxfzyxdzidafch.supabase.co';
  // ⚠️ REEMPLAZA ESTA KEY con la "anon public" de Supabase → Settings → API
  const SUPABASE_KEY = 'sb_secret_-rYCDZ5-BMzP13bDqvJtTg_FmtYp-7E';

  try {
    const { email, password } = JSON.parse(event.body);

    if (!email || !password) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'Email y contraseña son requeridos' })
      };
    }

    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();
    console.log('Supabase login response:', res.status, JSON.stringify(data));

    if (!res.ok || data.error || data.error_description) {
      let mensaje = data.error_description || data.msg || data.error || 'Credenciales incorrectas';
      // Mensajes amigables
      if (mensaje.includes('Invalid login credentials')) mensaje = 'Correo o contraseña incorrectos';
      if (mensaje.includes('Email not confirmed')) mensaje = 'Debes confirmar tu email primero. Revisa tu bandeja.';
      if (mensaje.includes('Email logins are disabled')) mensaje = 'Login por email desactivado en Supabase Settings';

      return {
        statusCode: 401,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: mensaje, raw: data })
      };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify(data) // { access_token, refresh_token, user, ... }
    };

  } catch (err) {
    console.error('auth-login error:', err);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message })
    };
  }
};
