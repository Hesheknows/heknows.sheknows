// netlify/functions/auth-register.js
// v5: ahora soporta CONVERTIR a advisor una cuenta que YA existe (cuando la
//     persona está logueada y manda su access_token), además de crear cuentas
//     nuevas. Ya no se rompe con "ya registrado" ni con correos mal escritos
//     de gente logueada (usa el correo real de su sesión).
//     ADVISOR se crea INACTIVO (available=false) hasta que pague Stripe.

const SUPABASE_URL = 'https://ydqcxbwxfzyxdzidafch.supabase.co';
const ANON_KEY = 'sb_publishable_6LRVFCwHqtf0r9daHpqbLg_oH9VTpRA';

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

  const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY;
  if (!SUPABASE_KEY) {
    return { statusCode: 200, headers, body: JSON.stringify({ error: 'Falta SUPABASE_SECRET_KEY en env' }) };
  }

  const adminHeaders = {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`
  };

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (e) {
    return { statusCode: 200, headers, body: JSON.stringify({ error: 'Body inválido: ' + e.message }) };
  }

  const {
    email, password, access_token,
    full_name, gender, role,
    bio, specialty, price_per_session, civil_status, years_together
  } = body;

  // Helper: buscar el id de un usuario por su correo (fuente de verdad)
  async function lookupUserIdByEmail(targetEmail) {
    if (!targetEmail) return null;
    try {
      const r = await fetch(
        `${SUPABASE_URL}/auth/v1/admin/users?email=${encodeURIComponent(targetEmail)}`,
        { headers: adminHeaders }
      );
      if (!r.ok) return null;
      const d = await r.json();
      const users = Array.isArray(d) ? d : (d.users || []);
      const found = users.find(u => (u.email || '').toLowerCase() === targetEmail.toLowerCase());
      return found ? found.id : null;
    } catch (e) {
      console.error('lookupUserIdByEmail error:', e.message);
      return null;
    }
  }

  let userId = null;
  let emailFinal = (email || '').trim();
  let sessionOut = { access_token: null, refresh_token: null, user: null };

  // ──────────────────────────────────────────────────────────
  // CAMINO A: la persona YA está logueada → la identificamos por
  // su token (NO hacemos signup, solo convertimos su cuenta).
  // ──────────────────────────────────────────────────────────
  if (access_token) {
    try {
      const uRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        headers: { Authorization: `Bearer ${access_token}`, apikey: ANON_KEY }
      });
      if (uRes.ok) {
        const u = await uRes.json();
        if (u?.id) {
          userId = u.id;
          emailFinal = u.email || emailFinal;
        }
      }
    } catch (e) {
      console.error('Error verificando token:', e.message);
    }
  }

  // ──────────────────────────────────────────────────────────
  // CAMINO B: persona nueva (o sin token) → signup con email+password.
  // Si ya existía, no pasa nada: la encontramos por correo y seguimos.
  // ──────────────────────────────────────────────────────────
  if (!userId) {
    if (!emailFinal || !password) {
      return { statusCode: 200, headers, body: JSON.stringify({ error: 'Falta email o contraseña' }) };
    }

    let signupData = {};
    try {
      const signupRes = await fetch(
        `${SUPABASE_URL}/auth/v1/signup?redirect_to=${encodeURIComponent('https://he-sheknows.com/confirm-email.html')}`,
        {
          method: 'POST',
          headers: adminHeaders,
          body: JSON.stringify({ email: emailFinal, password })
        }
      );
      signupData = await signupRes.json();
    } catch (e) {
      return { statusCode: 200, headers, body: JSON.stringify({ error: 'Error conectando con Supabase: ' + e.message }) };
    }

    // Guardar la sesión si el signup la devolvió (cuenta nueva sin confirmación)
    sessionOut = {
      access_token: signupData.session?.access_token || signupData.access_token || null,
      refresh_token: signupData.session?.refresh_token || signupData.refresh_token || null,
      user: signupData.user || null
    };

    // Fuente de verdad: buscar el id por correo (sirve para cuenta nueva o existente)
    userId = signupData.user?.id || signupData.id || null;
    if (!userId) {
      userId = await lookupUserIdByEmail(emailFinal);
    }

    // Si de plano no hay id, reportar el error real del signup
    if (!userId) {
      const errMsg = signupData.error_description || signupData.msg || signupData.error
        || 'No se pudo crear o encontrar la cuenta';
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ error: errMsg, supabase_raw: signupData })
      };
    }
  }

  // ──────────────────────────────────────────────────────────
  // Crear/actualizar profile (merge: si ya existe, lo actualiza)
  // ──────────────────────────────────────────────────────────
  const profileBody = {
    id: userId,
    email: emailFinal,
    full_name: full_name || null,
    gender: gender || null,
    role: role || 'user'
  };
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/profiles`, {
      method: 'POST',
      headers: { ...adminHeaders, 'Prefer': 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(profileBody)
    });
  } catch (e) {
    console.error('Error creando/actualizando profile:', e.message);
  }

  // ──────────────────────────────────────────────────────────
  // Si es advisor, crear/actualizar advisor_profile (INACTIVO hasta pagar)
  // ──────────────────────────────────────────────────────────
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
        headers: { ...adminHeaders, 'Prefer': 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(advisorBody)
      });
      advisor_created = advRes.ok;
      if (!advRes.ok) {
        advisor_error = await advRes.text().catch(() => 'unknown error');
        console.error('Error creando advisor_profile:', advRes.status, advisor_error);
      }
    } catch (e) {
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
      access_token: sessionOut.access_token,
      refresh_token: sessionOut.refresh_token,
      user: sessionOut.user || { id: userId, email: emailFinal },
      email_confirmation_required: !sessionOut.access_token,
      advisor_created,
      advisor_error,
      requires_payment: role === 'advisor'
    })
  };
};
