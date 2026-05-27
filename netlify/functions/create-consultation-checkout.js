// netlify/functions/create-consultation-checkout.js
// Crea Stripe Checkout Session dinámico con monto del advisor + split via Connect.
// Si el advisor no tiene Stripe Connect configurado, devuelve error.

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
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server misconfigured' }) };
  }

  try {
    const { access_token, advisor_id } = JSON.parse(event.body || '{}');

    if (!access_token || !advisor_id) {
      return { statusCode: 200, headers, body: JSON.stringify({ error: 'Faltan datos: access_token y advisor_id requeridos' }) };
    }

    // 1. Validar token del usuario que paga
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
    const userEmail = user.email;

    // 2. Validar que el usuario NO está pagando consulta a sí mismo
    if (userId === advisor_id) {
      return { statusCode: 200, headers, body: JSON.stringify({ error: 'No puedes consultarte a ti mismo' }) };
    }

    // 3. Obtener datos del advisor (precio + cuenta Connect)
    const advRes = await fetch(
      `${SUPABASE_URL}/rest/v1/advisor_profiles?id=eq.${advisor_id}&select=id,price_per_session,commission_rate,stripe_account_id,stripe_onboarding_complete,charges_enabled,available,specialty`,
      { headers: supabaseHeaders(SUPABASE_KEY) }
    );
    const advData = await advRes.json();

    if (!advData || advData.length === 0) {
      return { statusCode: 200, headers, body: JSON.stringify({ error: 'Advisor no encontrado' }) };
    }

    const advisor = advData[0];

    // 4. Validaciones del advisor
    if (advisor.available === false) {
      return { statusCode: 200, headers, body: JSON.stringify({ error: 'Este advisor no está disponible actualmente' }) };
    }

    if (!advisor.stripe_account_id) {
      return { statusCode: 200, headers, body: JSON.stringify({ error: 'Este advisor aún no ha configurado sus pagos. Intenta más tarde.' }) };
    }

    if (!advisor.stripe_onboarding_complete || !advisor.charges_enabled) {
      return { statusCode: 200, headers, body: JSON.stringify({ error: 'Este advisor aún está completando su verificación de pagos. Intenta más tarde.' }) };
    }

    const price = parseFloat(advisor.price_per_session);
    if (!price || price <= 0) {
      return { statusCode: 200, headers, body: JSON.stringify({ error: 'Este advisor no tiene precio configurado' }) };
    }

    // 5. Obtener nombre del advisor para el checkout
    const advProfRes = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${advisor_id}&select=full_name,avatar_url`,
      { headers: supabaseHeaders(SUPABASE_KEY) }
    );
    const advProf = await advProfRes.json();
    const advisorName = advProf?.[0]?.full_name || 'Advisor';

    // 6. Calcular split 70/30 (o lo que tenga commission_rate)
    const commissionRate = parseFloat(advisor.commission_rate) || 0.70;
    const amountTotal = Math.round(price * 100); // en centavos MXN
    const advisorAmount = Math.round(amountTotal * commissionRate);
    const platformFee = amountTotal - advisorAmount;

    // 7. Crear Stripe Checkout Session con Connect destination
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'mxn',
          product_data: {
            name: `Consulta con ${advisorName}`,
            description: `Acceso de 24h a chat privado con tu Advisor`
          },
          unit_amount: amountTotal
        },
        quantity: 1
      }],
      customer_email: userEmail,
      client_reference_id: userId,
      payment_intent_data: {
        application_fee_amount: platformFee,
        transfer_data: {
          destination: advisor.stripe_account_id
        }
      },
      metadata: {
        type: 'consultation',
        userId: userId,
        advisorId: advisor_id,
        advisorAmount: String(advisorAmount),
        platformFee: String(platformFee),
        commissionRate: String(commissionRate)
      },
      success_url: `https://he-sheknows.com/mensajes.html?advisorId=${advisor_id}&consultation=success`,
      cancel_url: `https://he-sheknows.com/buscar-advisors.html?consultation=cancelled`
    });

    console.log(`✅ Checkout creado: ${session.id} - $${price} MXN con advisor ${advisorName}`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        checkout_url: session.url,
        session_id: session.id
      })
    };

  } catch (err) {
    console.error('create-consultation-checkout error:', err);
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
