// netlify/functions/connect-account-status.js
//
// Verifica con Stripe si el advisor ya completó el onboarding
// (puede recibir pagos). Actualiza Supabase con el estado.

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const SUPABASE_URL = 'https://ydqcxbwxfzyxdzidafch.supabase.co';
const ANON_KEY = 'sb_publishable_6LRVFCwHqtf0r9daHpqbLg_oH9VTpRA';

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

  try {
    // Buscar cuenta de Stripe del advisor
    const advRes = await fetch(
      `${SUPABASE_URL}/rest/v1/advisor_profiles?id=eq.${advisorId}&select=stripe_account_id`,
      { headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` } }
    );
    const advData = await advRes.json();
    const advisor = advData[0];

    if (!advisor?.stripe_account_id) {
      return json(404, { error: 'No tienes cuenta de Stripe conectada' });
    }

    // Consultar a Stripe el estado de la cuenta
    const account = await stripe.accounts.retrieve(advisor.stripe_account_id);

    const onboarded =
      account.charges_enabled &&
      account.payouts_enabled &&
      account.details_submitted;

    // Actualizar Supabase con el estado actual
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
        body: JSON.stringify({ stripe_onboarding_complete: onboarded }),
      }
    );

    return json(200, {
      onboarded,
      charges_enabled: account.charges_enabled,
      payouts_enabled: account.payouts_enabled,
      details_submitted: account.details_submitted,
      requirements: {
        currently_due: account.requirements?.currently_due || [],
        disabled_reason: account.requirements?.disabled_reason || null,
      },
    });
  } catch (err) {
    console.error('Status check error:', err);
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
