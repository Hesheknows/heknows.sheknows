// netlify/functions/connect-account-status.js
//
// Verifica con Stripe si el advisor ya completó el onboarding
// (puede recibir pagos) y ACTUALIZA Supabase con el estado real.
//
// FIX: antes escribía con la llave pública (ANON_KEY), que NO tiene
// permiso de escritura por las reglas de seguridad (RLS), así que el
// guardado se caía en silencio y la casilla nunca se prendía.
// Ahora usa la llave secreta (SUPABASE_SECRET_KEY) para escribir.

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const SUPABASE_URL = 'https://ydqcxbwxfzyxdzidafch.supabase.co';
const ANON_KEY = 'sb_publishable_6LRVFCwHqtf0r9daHpqbLg_oH9VTpRA';
// 👇 llave secreta del servidor (la que SÍ puede escribir en la tabla)
const SERVICE_KEY = process.env.SUPABASE_SECRET_KEY;

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders(), body: '' };
  }
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method Not Allowed' });

  if (!SERVICE_KEY) {
    console.error('SUPABASE_SECRET_KEY no está configurada');
    return json(500, { error: 'Servidor mal configurado' });
  }

  let body;
  try { body = JSON.parse(event.body); } catch { return json(400, { error: 'JSON inválido' }); }

  const { token } = body;
  if (!token) return json(400, { error: 'Falta token' });

  // Verificar usuario (esto SÍ usa la llave pública + el token del usuario)
  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: ANON_KEY }
  });
  if (!userRes.ok) return json(401, { error: 'No autorizado' });
  const userData = await userRes.json();
  if (!userData.id) return json(401, { error: 'Usuario no encontrado' });

  const advisorId = userData.id;

  try {
    // Buscar cuenta de Stripe del advisor (lectura con llave secreta)
    const advRes = await fetch(
      `${SUPABASE_URL}/rest/v1/advisor_profiles?id=eq.${advisorId}&select=stripe_account_id`,
      { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
    );
    const advData = await advRes.json();
    const advisor = advData[0];

    if (!advisor?.stripe_account_id) {
      return json(404, { error: 'No tienes cuenta de Stripe conectada' });
    }

    // Consultar a Stripe el estado real de la cuenta
    const account = await stripe.accounts.retrieve(advisor.stripe_account_id);

    const onboarded =
      account.charges_enabled &&
      account.payouts_enabled &&
      account.details_submitted;

    // Actualizar Supabase con el estado actual (ESCRITURA con llave secreta)
    const patchRes = await fetch(
      `${SUPABASE_URL}/rest/v1/advisor_profiles?id=eq.${advisorId}`,
      {
        method: 'PATCH',
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({
          stripe_onboarding_complete: onboarded,
          charges_enabled: account.charges_enabled,
          payouts_enabled: account.payouts_enabled,
        }),
      }
    );

    if (!patchRes.ok) {
      // No rompemos la respuesta al usuario, pero lo dejamos en los logs
      const errText = await patchRes.text().catch(() => '');
      console.error('No se pudo actualizar advisor_profiles:', patchRes.status, errText);
    } else {
      console.log(`Estado sincronizado para advisor ${advisorId}: onboarded=${onboarded}`);
    }

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
