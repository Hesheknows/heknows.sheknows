// netlify/functions/delete-message.js
exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json(200, {});
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method Not Allowed' });

  let body;
  try { body = JSON.parse(event.body); }
  catch { return json(400, { error: 'JSON invalido' }); }

  const { token, messageId } = body;
  if (!token || !messageId) return json(400, { error: 'Faltan campos' });

  const SUPA_URL = 'https://ydqcxbwxfzyxdzidafch.supabase.co';
  const SERVICE_KEY = process.env.SUPABASE_SECRET_KEY;
  const ANON_KEY = 'sb_publishable_6LRVFCwHqtf0r9daHpqbLg_oH9VTpRA';

  // Verificar token
  const userRes = await fetch(`${SUPA_URL}/auth/v1/user`, {
    headers: { 'Authorization': `Bearer ${token}`, 'apikey': ANON_KEY }
  });
  if (!userRes.ok) return json(401, { error: 'Token invalido' });
  const { id: userId } = await userRes.json();

  try {
    // Verificar que el mensaje pertenece al usuario
    const msgRes = await fetch(
      `${SUPA_URL}/rest/v1/messages?id=eq.${messageId}&select=id,sender_id,body`,
      { headers: { 'Authorization': `Bearer ${SERVICE_KEY}`, 'apikey': SERVICE_KEY } }
    );
    const msgs = await msgRes.json();
    if (!msgs.length) return json(404, { error: 'Mensaje no encontrado' });
    if (msgs[0].sender_id !== userId) return json(403, { error: 'No puedes eliminar este mensaje' });

    // Marcar como eliminado en lugar de borrar (preserva el hilo)
    const updateRes = await fetch(`${SUPA_URL}/rest/v1/messages?id=eq.${messageId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'apikey': SERVICE_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ body: '__deleted__' })
    });

    if (!updateRes.ok) {
      const t = await updateRes.text();
      return json(500, { error: 'Error al eliminar: ' + t });
    }

    return json(200, { success: true });
  } catch (err) {
    console.error('delete-message error:', err);
    return json(500, { error: err.message });
  }
};

const json = (s, d) => ({
  statusCode: s,
  headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  body: JSON.stringify(d)
});
