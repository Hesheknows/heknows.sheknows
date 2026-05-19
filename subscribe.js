exports.handler = async function(event, context) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const { email, nombre } = JSON.parse(event.body);

  if (!email) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Email requerido' }) };
  }

  const BREVO_API_KEY = process.env.BREVO_API_KEY;

  const response = await fetch('https://api.brevo.com/v3/contacts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': BREVO_API_KEY
    },
    body: JSON.stringify({
      email: email,
      attributes: { NOMBRE: nombre || '' },
      listIds: [2],
      updateEnabled: true
    })
  });

  if (response.status === 201 || response.status === 204) {
    return {
      statusCode: 200,
      body: JSON.stringify({ success: true })
    };
  } else {
    const error = await response.json();
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || 'Error al suscribir' })
    };
  }
};
