// netlify/functions/stripe-webhook.js
// Recibe eventos de Stripe y actualiza Supabase

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  };

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: 'Method not allowed' };
  }

  const SUPABASE_URL = 'https://ydqcxbwxfzyxdzidafch.supabase.co';
  const SUPABASE_KEY = 'sb_secret_-rYCDZ5-BMzP13bDqvJtTg_FmtYp-7E';

  try {
    const body = JSON.parse(event.body);
    console.log('Stripe event:', body.type);

    if (body.type === 'checkout.session.completed') {
      const session = body.data.object;
      const email = session.customer_details?.email || session.customer_email;
      const amount = session.amount_total; // en centavos
      const planName = amount >= 29900 ? 'elite' : amount >= 19900 ? 'premium' : 'free';

      console.log('Payment completed:', email, amount, planName);

      if (email) {
        // Buscar usuario por email
        const userRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?email=eq.${encodeURIComponent(email)}&select=id,email`, {
          headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
        });
        const users = await userRes.json();

        if (users && users.length > 0) {
          const userId = users[0].id;

          // Actualizar plan del usuario
          await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`, {
            method: 'PATCH',
            headers: {
              'apikey': SUPABASE_KEY,
              'Authorization': `Bearer ${SUPABASE_KEY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              plan: planName,
              plan_activated_at: new Date().toISOString()
            })
          });

          console.log(`Plan ${planName} activado para ${email}`);
        } else {
          console.log('Usuario no encontrado:', email);
        }
      }
    }

    return { statusCode: 200, headers, body: JSON.stringify({ received: true }) };

  } catch (err) {
    console.error('Webhook error:', err);
    return { statusCode: 200, headers, body: JSON.stringify({ received: true, error: err.message }) };
  }
};
