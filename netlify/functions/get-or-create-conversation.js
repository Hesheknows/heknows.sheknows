// netlify/functions/get-or-create-conversation.js
// Busca una conversación existente entre el usuario y el advisor, o la crea.
// Devuelve { conversationId }.
// Nota: el "candado" de consulta activa vive en send-message.js (al enviar),
// así que aquí solo abrimos/creamos el hilo. Verificamos identidad por token.

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: cors(),
      body: JSON.stringify({ ok: true })
    };
  }
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method Not Allowed' });

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return json(400, { error: 'JSON inválido' }); }

  const { token, advisorId } = body;
  if (!token || !advisorId) return json(400, { error: 'Faltan campos: token o advisorId' });

  const SUPA_URL = 'https://ydqcxbwxfzyxdzidafch.supabase.co';
  const SERVICE_KEY = process.env.SUPABASE_SECRET_KEY;
  const ANON_KEY = 'sb_publishable_6LRVFCwHqtf0r9daHpqbLg_oH9VTpRA';

  if (!SERVICE_KEY) {
    console.error('SUPABASE_SECRET_KEY no está seteada');
    return json(500, { error: 'Configuración del servidor incompleta' });
  }

  // 1) Verificar el token y obtener el userId real
  let userId;
  try {
    const userRes = await fetch(`${SUPA_URL}/auth/v1/user`, {
      headers: { 'Authorization': `Bearer ${token}`, 'apikey': ANON_KEY }
    });
    if (!userRes.ok) return json(401, { error: 'Token inválido o expirado' });
    const userData = await userRes.json();
    userId = userData.id;
    if (!userId) return json(401, { error: 'No se pudo obtener el usuario' });
  } catch (e) {
    console.error('Auth error:', e.message);
    return json(500, { error: 'Error verificando usuario' });
  }

  // No permitir conversación consigo mismo
  if (userId === advisorId) {
    return json(400, { error: 'No puedes iniciar una conversación contigo mismo' });
  }

  const adminHeaders = {
    'Authorization': `Bearer ${SERVICE_KEY}`,
    'apikey': SERVICE_KEY
  };

  try {
    // 2) ¿Ya existe una conversación entre este usuario y este advisor?
    const existingRes = await fetch(
      `${SUPA_URL}/rest/v1/conversations?user_id=eq.${userId}&advisor_id=eq.${advisorId}&select=id&limit=1`,
      { headers: adminHeaders }
    );
    if (!existingRes.ok) {
      const t = await existingRes.text();
      console.error('Error buscando conversación:', existingRes.status, t);
      return json(500, { error: 'Error buscando conversación' });
    }
    const rows = await existingRes.json();

    if (Array.isArray(rows) && rows.length > 0) {
      // Ya existe → devolver su id
      return json(200, { conversationId: rows[0].id, created: false });
    }

    // 3) No existe → crearla
    const createRes = await fetch(`${SUPA_URL}/rest/v1/conversations`, {
      method: 'POST',
      headers: {
        ...adminHeaders,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({ user_id: userId, advisor_id: advisorId })
    });
    if (!createRes.ok) {
      const t = await createRes.text();
      console.error('Error creando conversación:', createRes.status, t);
      return json(500, { error: 'Error creando conversación' });
    }
    const [conv] = await createRes.json();
    return json(200, { conversationId: conv.id, created: true });

  } catch (err) {
    console.error('get-or-create-conversation catch:', err.message);
    return json(500, { error: err.message });
  }
};

function cors() {
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };
}

const json = (s, d) => ({
  statusCode: s,
  headers: cors(),
  body: JSON.stringify(d)
});
