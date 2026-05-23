const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method Not Allowed' });

  let body;
  try { body = JSON.parse(event.body); } catch { return json(400, { error: 'JSON inválido' }); }

  const { token, advisorId, price, successUrl, cancelUrl } = body;
  if (!token || !advisorId || !price) return json(400, { error: 'Faltan datos' });

  const SUPABASE_URL = 'https://ydqcxbwxfzyxdzidafch.supabase.co';
  const ANON_KEY = 'sb_publishable_6LRVFCwHqtf0r9daHpqbLg_oH9VTpRA';

  // Verify user
  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: ANON_KEY }
  });
  if (!userRes.ok) return json(401, { error: 'No autorizado' });
  const userData = await userRes.json();
  if (!userData.id) return json(401, { error: 'Usuario no encontrado' });

  // Get advisor name
  const advRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${advisorId}&select=full_name`, {
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` }
  });
  const advData = await advRes.json();
  const advisorName = advData[0]?.full_name || 'Advisor';

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
          unit_amount: price * 100, // Stripe uses cents
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        userId: userData.id,
        advisorId,
        type: 'consultation'
      }
    });

    return json(200, { url: session.url });
  } catch (err) {
    console.error('Stripe error:', err);
    return json(500, { error: 'Error al crear el pago' });
  }
};

const json = (s, d) => ({
  statusCode: s,
  headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  body: JSON.stringify(d)
});
