// netlify/functions/connect-advisor.js
// Crea cuenta Stripe Connect Express para el advisor y genera onboarding link.
// Si la cuenta ya existe, solo genera un nuevo link (para refresh).

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const SUPABASE_URL = 'https://ydqcxbwxfzyxdzidafch.supabase.co';
  const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY;

  if (!SUPABASE_KEY) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'SUPABASE_SECRET_KEY missing' }) };
  }

  try {
    const { access_token } = JSON.parse(event.body || '{}');

    if (!access_token) {
      return { statusCode: 200, headers, body: JSON.stringify({ error: 'Falta access_token' }) };
    }

    // 1. Validar token y obtener user
    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${access_token}`
      }
    });

    if (!userRes.ok) {
      return { statusCode: 200, headers, body: JSON.stringify({ error: 'Sesión inválida' }) };
    }

    const user = await userRes.json();
    const userId = user.id;
    const email = user.email;

    // 2. Buscar advisor_profile en Supabase
    const apRes = await fetch(
      `${SUPABASE_URL}/rest/v1/advisor_profiles?id=eq.${userId}&select=id,stripe_account_id,stripe_onboarding_complete`,
      { headers: supabaseHeaders(SUPABASE_KEY) }
    );
    const apData = await apRes.json();

    if (!apData || apData.length === 0) {
      return { statusCode: 200, headers, body: JSON.stringify({ error: 'No tienes perfil de advisor.' }) };
    }

    const advisor = apData[0];
    let accountId = advisor.stripe_account_id;

    // 3. Si NO tiene cuenta Connect, crearla
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        country: 'MX',
        email: email,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true }
        },
        business_type: 'individual',
        metadata: {
          advisor_id: userId,
          source: 'he-sheknows'
        }
      });

      accountId = account.id;

      // Guardar el account_id en Supabase
      await fetch(`${SUPABASE_URL}/rest/v1/advisor_profiles?id=eq.${userId}`, {
        method: 'PATCH',
        headers: {
          ...supabaseHeaders(SUPABASE_KEY),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ stripe_account_id: accountId })
      });

      console.log(`✅ Stripe Connect account creada para ${email}: ${accountId}`);
    }

    // 4. Generar onboarding link (siempre, para casos de refresh)
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: 'https://he-sheknows.com/perfil.html?stripe=refresh',
      return_url: 'https://he-sheknows.com/perfil.html?stripe=complete',
      type: 'account_onboarding'
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        account_id: accountId,
        onboarding_url: accountLink.url,
        already_onboarded: advisor.stripe_onboarding_complete || false
      })
    };

  } catch (err) {
    console.error('connect-advisor error:', err);
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ error: 'Error: ' + err.message })
    };
  }
};

function supabaseHeaders(key) {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`
  };
}
