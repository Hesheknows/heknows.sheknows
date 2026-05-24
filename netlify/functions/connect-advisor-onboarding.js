// netlify/functions/connect-advisor-onboarding.js
//
// Crea una cuenta de Stripe Connect Express para que un advisor
// pueda recibir pagos automáticos en su CLABE.

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const SUPABASE_URL = 'https://ydqcxbwxfzyxdzidafch.supabase.co';
const ANON_KEY = 'sb_publishable_6LRVFCwHqtf0r9daHpqbLg_oH9VTpRA';
const SITE_URL = 'https://he-sheknows.com';

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders(), body: '' };
  }
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method Not Allowed' });

  let body;
  try { body = JSON.parse(event.body); } catch { return json(400, { error: 'JSON inválido' }); }

  const { token } = body;
  if (!token) return json(400, { error: 'Falta token' });

  // Verificar usuario
  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: ANON_KEY }
  });
  if (!userRes.ok) return json(401, { error: 'No autorizado' });
  const userData = await userRes.json();
  if (!userData.id) return json(401, { error: 'Usuario no encontrado' });

  const advisorId = userData.id;
  const advisorEmail = userData.email;

  try {
    // 1. Buscar si ya tiene cuenta de Stripe Connect
    const advRes = await fetch(
      `${SUPABASE_URL}/rest/v1/advisor_profiles?id=eq.${advisorId}&select=stripe_account_id,stripe_onboarding_complete`,
      { headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` } }
    );
    const advData = await advRes.json();
    const advisor = advData[0];

    if (!advisor) return json(404, { error: 'No tienes perfil de advisor' });

    let accountId = advisor.stripe_account_id;

    // 2. Si no tiene cuenta, crearla
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        country: 'MX',
        email: advisorEmail,
        capabilities: {
          transfers: { requested: true },
        },
        business_type: 'individual',
        metadata: {
          advisor_id: advisorId,
          platform: 'he-sheknows',
        },
        settings: {
          payouts: {
            schedule: { interval: 'daily' }, // depósito diario a su CLABE
          },
        },
      });

      accountId = account.id;

      // Guardar el ID en Supabase
      await fetch(
        `${SUPABASE_URL}/rest/v1/advisor_profiles?id=eq.${advisorId}`,
        {
          method: 'PATCH',
          headers: {
            apikey: ANON_KEY,
            Authorization: `Bearer ${ANON_KEY}`,
            'Content-Type': 'application/json',
            Prefer: 'return=minimal',
          },
          body: JSON.stringify({ stripe_account_id: accountId }),
        }
      );
    }

    // 3. Crear link de onboarding (sirve también para reanudar si abandonó)
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${SITE_URL}/payouts.html?refresh=true`,
      return_url: `${SITE_URL}/payouts.html?onboarded=true`,
      type: 'account_onboarding',
    });

    return json(200, {
      url: accountLink.url,
      account_id: accountId,
      already_onboarded: advisor.stripe_onboarding_complete === true,
    });
  } catch (err) {
    console.error('Onboarding error:', err);
    return json(500, { error: err.message });
  }
};

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

function json(s, d) {
  return {
    statusCode: s,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
    body: JSON.stringify(d),
  };
}
