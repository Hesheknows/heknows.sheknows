// netlify/functions/stripe-webhook.js
//
// Webhook seguro de Stripe para He Knows She Knows.
// Maneja:
//   1) Membresías de advisors ($99/mes o $999/año)
//   2) Consultas individuales (con split automático vía Stripe Connect)
//   3) Onboarding de advisor en Stripe Connect
//
// Cambios de seguridad vs versión anterior:
//   - SUPABASE_KEY ya NO está hardcodeada, viene de env var
//   - Verifica firma de Stripe (rechaza pagos falsos)

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const SUPABASE_URL = 'https://ydqcxbwxfzyxdzidafch.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  };

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: 'Method not allowed' };
  }

  if (!SUPABASE_KEY) {
    console.error('SUPABASE_SECRET_KEY no está configurada');
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server misconfigured' }) };
  }

  // 1. Verificar firma de Stripe — esto evita que cualquiera simule pagos
  let stripeEvent;
  try {
    const signature = event.headers['stripe-signature'] || event.headers['Stripe-Signature'];
    if (!STRIPE_WEBHOOK_SECRET) {
      // Si no hay secret configurado, aún parseamos pero loggeamos warning
      console.warn('⚠️ STRIPE_WEBHOOK_SECRET no configurada — webhook sin verificar');
      stripeEvent = JSON.parse(event.body);
    } else if (!signature) {
      console.error('Falta header stripe-signature');
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'No signature' }) };
    } else {
      stripeEvent = stripe.webhooks.constructEvent(
        event.body,
        signature,
        STRIPE_WEBHOOK_SECRET
      );
    }
  } catch (err) {
    console.error('Verificación de firma falló:', err.message);
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid signature' }) };
  }

  console.log('Stripe event:', stripeEvent.type);

  try {
    // 2. Manejar tipos de eventos
    switch (stripeEvent.type) {

      // ────────────────────────────────────────────────
      // PAGO COMPLETADO (membresía advisor O consulta)
      // ────────────────────────────────────────────────
      case 'checkout.session.completed': {
        const session = stripeEvent.data.object;
        const metadata = session.metadata || {};

        // Caso A: es una consulta (Stripe Connect)
        if (metadata.type === 'consultation') {
          console.log('Consulta pagada:', {
            user: metadata.userId,
            advisor: metadata.advisorId,
            amount: session.amount_total,
            advisorAmount: metadata.advisorAmount,
            platformFee: metadata.platformFee
          });

          // Stripe ya hizo el split automáticamente (advisor recibe 70%/90%
          // directo en su cuenta Connect). Solo necesitamos registrar la consulta
          // y desbloquear el acceso del usuario al advisor por 24h.

          // Opcional: registrar en tabla `consultations` cuando exista
          // await fetch(`${SUPABASE_URL}/rest/v1/consultations`, {
          //   method: 'POST',
          //   headers: supabaseHeaders(),
          //   body: JSON.stringify({
          //     user_id: metadata.userId,
          //     advisor_id: metadata.advisorId,
          //     amount: session.amount_total,
          //     advisor_amount: parseInt(metadata.advisorAmount, 10),
          //     platform_fee: parseInt(metadata.platformFee, 10),
          //     commission_rate: parseFloat(metadata.commissionRate),
          //     status: 'paid',
          //     stripe_session_id: session.id,
          //     paid_at: new Date().toISOString()
          //   })
          // });

          break;
        }

        // Caso B: es membresía de advisor
        const email = session.customer_details?.email || session.customer_email;
        const amount = session.amount_total; // centavos MXN

        // SOLO planes de advisor — modelo limpio
        let plan = null;
        if (amount >= 99900) plan = 'advisor_anual';      // $999
        else if (amount >= 9900) plan = 'advisor_mensual'; // $99

        if (!plan) {
          console.log('Pago sin plan reconocido, monto:', amount);
          break;
        }

        if (!email) {
          console.log('Pago sin email asociado');
          break;
        }

        console.log('Membresía advisor pagada:', email, plan);

        // Buscar usuario por email
        const userRes = await fetch(
          `${SUPABASE_URL}/rest/v1/profiles?email=eq.${encodeURIComponent(email)}&select=id,email,role`,
          { headers: supabaseHeaders() }
        );
        const users = await userRes.json();

        if (!users || users.length === 0) {
          console.log('Usuario no encontrado en Supabase:', email);
          break;
        }

        const user = users[0];

        // Actualizar perfil: plan + rol = advisor
        await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${user.id}`, {
          method: 'PATCH',
          headers: { ...supabaseHeaders(), 'Content-Type': 'application/json' },
          body: JSON.stringify({
            plan,
            role: 'advisor',
            plan_activated_at: new Date().toISOString()
          })
        });

        // También actualizar commission_rate en advisor_profiles
        const commissionRate = plan === 'advisor_anual' ? 0.90 : 0.70;
        await fetch(`${SUPABASE_URL}/rest/v1/advisor_profiles?id=eq.${user.id}`, {
          method: 'PATCH',
          headers: { ...supabaseHeaders(), 'Content-Type': 'application/json' },
          body: JSON.stringify({ commission_rate: commissionRate })
        });

        console.log(`✅ Plan ${plan} activado para ${email}, comisión ${commissionRate * 100}%`);
        break;
      }

      // ────────────────────────────────────────────────
      // ADVISOR COMPLETA ONBOARDING DE CONNECT
      // ────────────────────────────────────────────────
      case 'account.updated': {
        const account = stripeEvent.data.object;
        const advisorId = account.metadata?.advisor_id;

        if (!advisorId) {
          console.log('account.updated sin advisor_id en metadata');
          break;
        }

        const onboarded =
          account.charges_enabled &&
          account.payouts_enabled &&
          account.details_submitted;

        await fetch(`${SUPABASE_URL}/rest/v1/advisor_profiles?id=eq.${advisorId}`, {
          method: 'PATCH',
          headers: { ...supabaseHeaders(), 'Content-Type': 'application/json' },
          body: JSON.stringify({ stripe_onboarding_complete: onboarded })
        });

        console.log(`Advisor ${advisorId} onboarding: ${onboarded ? '✅ completo' : '⏳ pendiente'}`);
        break;
      }

      default:
        console.log('Evento ignorado:', stripeEvent.type);
    }

    return { statusCode: 200, headers, body: JSON.stringify({ received: true }) };
  } catch (err) {
    console.error('Webhook error:', err);
    // Devolver 200 para que Stripe no reintente; el error se loggea
    return { statusCode: 200, headers, body: JSON.stringify({ received: true, error: err.message }) };
  }
};

function supabaseHeaders() {
  return {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
  };
}
