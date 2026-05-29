// netlify/functions/stripe-webhook.js
// v5: ahora valida la firma con DOS secretos (webhook de pagos + webhook
//      de cuentas conectadas), para soportar los dos destinos de Stripe.

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { sendEmail, emailNuevaConsulta } = require('./send-email');

const SUPABASE_URL = 'https://ydqcxbwxfzyxdzidafch.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY;

// 👇 Dos secretos posibles:
//    - STRIPE_WEBHOOK_SECRET         → webhook viejo (pagos de membresía/consulta, "Tu cuenta")
//    - STRIPE_WEBHOOK_SECRET_CONNECT → webhook nuevo (cuentas conectadas: account.updated, payout.paid)
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const STRIPE_WEBHOOK_SECRET_CONNECT = process.env.STRIPE_WEBHOOK_SECRET_CONNECT;

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

  // 1. Verificar firma de Stripe (probando los dos secretos posibles)
  let stripeEvent;
  try {
    const signature = event.headers['stripe-signature'] || event.headers['Stripe-Signature'];

    // Lista de secretos configurados (ignora los que no existan)
    const secrets = [STRIPE_WEBHOOK_SECRET, STRIPE_WEBHOOK_SECRET_CONNECT].filter(Boolean);

    if (secrets.length === 0) {
      console.warn('⚠️ Ningún secreto de webhook configurado — webhook sin verificar');
      stripeEvent = JSON.parse(event.body);
    } else if (!signature) {
      console.error('Falta header stripe-signature');
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'No signature' }) };
    } else {
      // Intenta validar con cada secreto; con el primero que funcione, listo.
      let verified = null;
      let lastErr = null;
      for (const secret of secrets) {
        try {
          verified = stripe.webhooks.constructEvent(event.body, signature, secret);
          break;
        } catch (e) {
          lastErr = e;
        }
      }
      if (!verified) {
        throw lastErr || new Error('No se pudo verificar la firma con ningún secreto');
      }
      stripeEvent = verified;
    }
  } catch (err) {
    console.error('Verificación de firma falló:', err.message);
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid signature' }) };
  }

  console.log('Stripe event:', stripeEvent.type);

  try {
    switch (stripeEvent.type) {

      // ────────────────────────────────────────────────
      // PAGO COMPLETADO (membresía advisor O consulta)
      // ────────────────────────────────────────────────
      case 'checkout.session.completed': {
        const session = stripeEvent.data.object;
        const metadata = session.metadata || {};

        // Caso A: consulta privada (con split via Stripe Connect)
        if (metadata.type === 'consultation') {
          console.log('💰 Consulta pagada:', {
            user: metadata.userId,
            advisor: metadata.advisorId,
            amount: session.amount_total
          });

          // Registrar consulta y activar acceso 24h
          const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

          await fetch(`${SUPABASE_URL}/rest/v1/consultations`, {
            method: 'POST',
            headers: {
              ...supabaseHeaders(),
              'Content-Type': 'application/json',
              'Prefer': 'return=minimal'
            },
            body: JSON.stringify({
              user_id: metadata.userId,
              advisor_id: metadata.advisorId,
              amount: session.amount_total / 100,
              advisor_amount: parseFloat(metadata.advisorAmount) / 100,
              platform_fee: parseFloat(metadata.platformFee) / 100,
              commission_rate: parseFloat(metadata.commissionRate),
              status: 'paid',
              stripe_session_id: session.id,
              stripe_payment_intent_id: session.payment_intent,
              paid_at: new Date().toISOString(),
              expires_at: expiresAt
            })
          });

          console.log(`✅ Consulta registrada. Acceso hasta: ${expiresAt}`);

          // ────────────────────────────────────────────
          // 📧 ENVIAR EMAIL AL ADVISOR
          // (no bloqueante: si falla, el pago igual queda registrado)
          // ────────────────────────────────────────────
          try {
            // Obtener email + nombre del advisor desde profiles
            const advisorRes = await fetch(
              `${SUPABASE_URL}/rest/v1/profiles?id=eq.${metadata.advisorId}&select=email,full_name`,
              { headers: supabaseHeaders() }
            );
            const [advisor] = await advisorRes.json();

            // Obtener nombre del usuario que pagó
            const userRes = await fetch(
              `${SUPABASE_URL}/rest/v1/profiles?id=eq.${metadata.userId}&select=full_name,email`,
              { headers: supabaseHeaders() }
            );
            const [usuario] = await userRes.json();

            if (advisor?.email) {
              const tmpl = emailNuevaConsulta({
                advisorName: advisor.full_name || 'advisor',
                userName: usuario?.full_name || 'Un usuario',
                amount: session.amount_total / 100
              });
              await sendEmail({
                to: advisor.email,
                toName: advisor.full_name,
                subject: tmpl.subject,
                htmlContent: tmpl.htmlContent,
                textContent: tmpl.textContent
              });
              console.log(`📧 Email de nueva consulta enviado a ${advisor.email}`);
            } else {
              console.warn('⚠️ No se pudo obtener email del advisor:', metadata.advisorId);
            }
          } catch (emailErr) {
            console.error('❌ Error al enviar email de nueva consulta:', emailErr.message);
            // No re-lanzamos: el pago ya quedó registrado, el email es secundario
          }

          break;
        }

        // Caso B: membresía de advisor
        const email = session.customer_details?.email || session.customer_email;
        const amount = session.amount_total;

        let plan = null;
        if (amount >= 99900) plan = 'advisor_anual';
        else if (amount >= 9900) plan = 'advisor_mensual';

        if (!plan || !email) {
          console.log('Pago sin plan/email reconocido');
          break;
        }

        console.log('Membresía advisor pagada:', email, plan);

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

        await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${user.id}`, {
          method: 'PATCH',
          headers: { ...supabaseHeaders(), 'Content-Type': 'application/json' },
          body: JSON.stringify({
            plan,
            role: 'advisor',
            plan_activated_at: new Date().toISOString()
          })
        });

        const commissionRate = plan === 'advisor_anual' ? 0.90 : 0.70;
        await fetch(`${SUPABASE_URL}/rest/v1/advisor_profiles?id=eq.${user.id}`, {
          method: 'PATCH',
          headers: { ...supabaseHeaders(), 'Content-Type': 'application/json' },
          body: JSON.stringify({
            commission_rate: commissionRate,
            available: true
          })
        });

        console.log(`✅ Plan ${plan} activado para ${email}`);
        break;
      }

      // ────────────────────────────────────────────────
      // ADVISOR COMPLETA / ACTUALIZA ONBOARDING DE CONNECT
      // ────────────────────────────────────────────────
      case 'account.updated': {
        const account = stripeEvent.data.object;
        const advisorId = account.metadata?.advisor_id;

        if (!advisorId) {
          console.log('account.updated sin advisor_id en metadata');
          break;
        }

        const onboardingComplete = account.details_submitted;
        const chargesEnabled = account.charges_enabled;
        const payoutsEnabled = account.payouts_enabled;

        await fetch(`${SUPABASE_URL}/rest/v1/advisor_profiles?id=eq.${advisorId}`, {
          method: 'PATCH',
          headers: { ...supabaseHeaders(), 'Content-Type': 'application/json' },
          body: JSON.stringify({
            stripe_onboarding_complete: onboardingComplete,
            charges_enabled: chargesEnabled,
            payouts_enabled: payoutsEnabled
          })
        });

        const status = (onboardingComplete && chargesEnabled && payoutsEnabled)
          ? '✅ COMPLETO - puede recibir pagos'
          : '⏳ pendiente';
        console.log(`Connect onboarding advisor ${advisorId}: ${status}`);
        break;
      }

      // ────────────────────────────────────────────────
      // PAYOUT RECIBIDO EN BANCO DEL ADVISOR
      // ────────────────────────────────────────────────
      case 'payout.paid': {
        const payout = stripeEvent.data.object;
        console.log(`💸 Payout pagado: ${payout.amount / 100} MXN a cuenta ${payout.destination}`);
        // (futuro: notificar al advisor por email/Slack)
        break;
      }

      default:
        console.log('Evento ignorado:', stripeEvent.type);
    }

    return { statusCode: 200, headers, body: JSON.stringify({ received: true }) };
  } catch (err) {
    console.error('Webhook error:', err);
    return { statusCode: 200, headers, body: JSON.stringify({ received: true, error: err.message }) };
  }
};

function supabaseHeaders() {
  return {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
  };
}
