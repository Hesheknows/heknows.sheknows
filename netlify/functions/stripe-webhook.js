// netlify/functions/stripe-webhook.js

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
      const amount = session.amount_total; // en centavos MXN

      // Detectar plan según monto
      // $99 = 9900, $199 = 19900, $299 = 29900, $999 = 99900
      let plan = 'free';
      if (amount >= 99900) plan = 'advisor_anual';
      else if (amount >= 29900) plan = 'elite';
      else if (amount >= 19900) plan = 'premium';
      else if (amount >= 9900) plan = 'advisor_mensual';

      console.log('Payment completed:', email, amount, plan);

      if (email && plan !== 'free') {
        // Buscar usuario por email
        const userRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?email=eq.${encodeURIComponent(email)}&select=id,email,role`, {
          headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
        });
        const users = await userRes.json();

        if (users && users.length > 0) {
          const user = users[0];
          const updates = {
            plan,
            plan_activated_at: new Date().toISOString()
          };

          // Si es plan de advisor, actualizar rol también
          if (plan.includes('advisor')) {
            updates.role = 'advisor';
          }

          await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${user.id}`, {
            method: 'PATCH',
            headers: {
              'apikey': SUPABASE_KEY,
              'Authorization': `Bearer ${SUPABASE_KEY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(updates)
          });

          console.log(`Plan ${plan} activado para ${email}`);
        } else {
          console.log('Usuario no encontrado en Supabase:', email);
        }
      }
    }

    return { statusCode: 200, headers, body: JSON.stringify({ received: true }) };

  } catch (err) {
    console.error('Webhook error:', err);
    return { statusCode: 200, headers, body: JSON.stringify({ received: true, error: err.message }) };
  }
};
