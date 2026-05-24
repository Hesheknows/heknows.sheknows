// netlify/functions/create-consultation-checkout.js
//
// Cobra al usuario por una consulta y manda el 70% o 90% al advisor
// automáticamente vía Stripe Connect (depósito directo a su CLABE).
// La plataforma se queda con el 30% o 10% respectivamente.

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const SUPABASE_URL = 'https://ydqcxbwxfzyxdzidafch.supabase.co';
const ANON_KEY = 'sb_publishable_6LRVFCwHqtf0r9daHpqbLg_oH9VTpRA';

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method Not Allowed' });

  let body;
  try { body = JSON.parse(event.body); } catch { return json(400, { error: 'JSON inválido' }); }

  const { token, advisorId, successUrl, cancelUrl } = body;
  if (!token || !advisorId) return json(400, { error: 'Faltan datos' });

  // 1. Verificar usuario
  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: ANON_KEY }
  });
  if (!userRes.ok) return json(401, { error: 'No autorizado' });
  const userData = await userRes.json();
  if (!userData.id) return json(401, { error: 'Usuario no encontrado' });

  // 2. Obtener nombre del advisor desde `profiles`
  const profRes = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?id=eq.${advisorId}&select=full_name`,
    { headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` } }
  );
  const profData = await profRes.json();
  const advisorName = profData[0]?.full_name || 'Advisor';

  // 3. Obtener datos del advisor desde `advisor_profiles`
  //    (precio, comisión, cuenta de Stripe Connect)
  const advRes = await fetch(
    `${SUPABASE_URL}/rest/v1/advisor_profiles?id=eq.${advisorId}&select=price_per_session,commission_rate,stripe_account_id,stripe_onboarding_complete`,
    { headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` } }
  );
  const advData = await advRes.json();
  const advisor = advData[0];

  if (!advisor) return json(404, { error: 'Advisor no encontrado' });

  // 4. Verificar que el advisor pueda recibir pagos
  if (!advisor.stripe_account_id || !advisor.stripe_onboarding_complete) {
    return json(409, {
      error: 'Este advisor aún no ha configurado su cuenta de pagos',
      code: 'ADVISOR_NOT_ONBOARDED'
    });
  }

  const pricePesos = Number(advisor.price_per_session);
  if (!pricePesos || pricePesos < 10) {
    return json(400, { error: 'Precio del advisor inválido' });
  }

  // 5. Calcular split. commission_rate es lo que gana el advisor (0.70 o 0.90)
  const rate = Number(advisor.commission_rate) || 0.70; // default 70%
  const priceCents = Math.round(pricePesos * 100); // Stripe usa centavos
  const advisorAmount = Math.round(priceCents * rate);
  const platformFee = priceCents - advisorAmount;

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'mxn',
          product_data: {
            name: `Consulta con ${advisorName}`,
            description: 'Acceso privado de 24 horas · He Knows She Knows',
          },
          unit_amount: priceCents,
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: successUrl,
      cancel_url: cancelUrl,
      // 👇 ESTO ES LO NUEVO: split automático al advisor
      payment_intent_data: {
        application_fee_amount: platformFee, // lo que se queda la plataforma
        transfer_data: {
          destination: advisor.stripe_account_id, // a dónde va el resto
        },
      },
      metadata: {
        userId: userData.id,
        advisorId,
        type: 'consultation',
        advisorAmount: String(advisorAmount),
        platformFee: String(platformFee),
        commissionRate: String(rate),
      }
    });

    return json(200, { url: session.url });
  } catch (err) {
    console.error('Stripe error:', err);
    return json(500, { error: 'Error al crear el pago: ' + err.message });
  }
};

const json = (s, d) => ({
  statusCode: s,
  headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  body: JSON.stringify(d)
});
