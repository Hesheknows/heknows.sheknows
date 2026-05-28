// netlify/functions/send-message.js
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method Not Allowed' });

  let body;
  try { body = JSON.parse(event.body); }
  catch { return json(400, { error: 'JSON inválido' }); }

  const { token, conversationId, advisorId, body: msgBody } = body;
  if (!token || !msgBody?.trim()) return json(400, { error: 'Faltan campos: token o body' });

  const SUPA_URL = 'https://ydqcxbwxfzyxdzidafch.supabase.co';
  const SERVICE_KEY = process.env.SUPABASE_SECRET_KEY;
  const ANON_KEY = 'sb_publishable_6LRVFCwHqtf0r9daHpqbLg_oH9VTpRA';

  // Diagnóstico: verificar que SERVICE_KEY existe
  if (!SERVICE_KEY) {
    console.error('SUPABASE_SECRET_KEY no está seteada en las env vars de Netlify');
    return json(500, { error: 'Configuración del servidor incompleta (SERVICE_KEY faltante)' });
  }

  // Verificar token del usuario con anon key
  const userRes = await fetch(`${SUPA_URL}/auth/v1/user`, {
    headers: { 'Authorization': `Bearer ${token}`, 'apikey': ANON_KEY }
  });
  if (!userRes.ok) {
    const errText = await userRes.text();
    console.error('Auth error:', userRes.status, errText);
    return json(401, { error: 'Token inválido o expirado' });
  }
  const userData = await userRes.json();
  const userId = userData.id;
  if (!userId) return json(401, { error: 'No se pudo obtener userId del token' });

  try {
    let convId = conversationId;

    // ============================================================
    // CANDADO: verificar que exista una consulta ACTIVA y NO vencida
    // entre el usuario y el advisor de esta conversación.
    // Ventana de 24h: ambos (usuario y advisor) pueden escribir
    // mientras la consulta esté 'active' y expires_at sea futuro.
    // ============================================================

    // 1) Determinar quién es el usuario y quién es el advisor de la conversación
    let convUserId = null;     // el que paga (user_id en consultations)
    let convAdvisorId = null;  // el que recibe (advisor_id en consultations)

    if (convId) {
      // Si ya hay conversación, sacamos los participantes de ella
      const convRes = await fetch(
        `${SUPA_URL}/rest/v1/conversations?id=eq.${convId}&select=user_id,advisor_id`,
        { headers: { 'Authorization': `Bearer ${SERVICE_KEY}`, 'apikey': SERVICE_KEY } }
      );
      const convRows = await convRes.json();
      if (!convRows.length) return json(404, { error: 'Conversación no encontrada' });
      convUserId = convRows[0].user_id;
      convAdvisorId = convRows[0].advisor_id;
    } else {
      // Sin conversación todavía: el que escribe es el usuario y advisorId viene en el body
      if (!advisorId) return json(400, { error: 'Se requiere conversationId o advisorId' });
      convUserId = userId;
      convAdvisorId = advisorId;
    }

    // 2) Confirmar que quien escribe es uno de los dos participantes
    if (userId !== convUserId && userId !== convAdvisorId) {
      return json(403, { error: 'No participas en esta conversación' });
    }

    // 3) Buscar una consulta activa y no vencida entre ese par
    const nowISO = new Date().toISOString();
    const consultaRes = await fetch(
      `${SUPA_URL}/rest/v1/consultations?user_id=eq.${convUserId}&advisor_id=eq.${convAdvisorId}&status=eq.active&expires_at=gt.${nowISO}&select=id,expires_at&limit=1`,
      { headers: { 'Authorization': `Bearer ${SERVICE_KEY}`, 'apikey': SERVICE_KEY } }
    );
    if (!consultaRes.ok) {
      const t = await consultaRes.text();
      console.error('Error verificando consulta:', consultaRes.status, t);
      return json(500, { error: 'Error verificando consulta activa' });
    }
    const consultas = await consultaRes.json();

    if (!consultas.length) {
      // No hay consulta activa → bloquear con mensaje amable
      return json(403, {
        error: 'no_active_consultation',
        message: 'Esta consulta finalizó o no está activa. Inicia una nueva consulta para conversar.'
      });
    }

    // ============================================================
    // FIN DEL CANDADO — a partir de aquí, flujo normal de envío
    // ============================================================

    // Si no hay conversationId, buscar o crear una con el advisorId
    if (!convId) {
      const existingRes = await fetch(
        `${SUPA_URL}/rest/v1/conversations?user_id=eq.${userId}&advisor_id=eq.${advisorId}&select=id`,
        { headers: { 'Authorization': `Bearer ${SERVICE_KEY}`, 'apikey': SERVICE_KEY } }
      );
      if (!existingRes.ok) {
        const t = await existingRes.text();
        console.error('Error buscando conversación existente:', existingRes.status, t);
        return json(500, { error: 'Error buscando conversación: ' + t });
      }
      const rows = await existingRes.json();

      if (rows.length > 0) {
        convId = rows[0].id;
      } else {
        const createRes = await fetch(`${SUPA_URL}/rest/v1/conversations`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${SERVICE_KEY}`,
            'apikey': SERVICE_KEY,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
          },
          body: JSON.stringify({ user_id: userId, advisor_id: advisorId })
        });
        if (!createRes.ok) {
          const t = await createRes.text();
          console.error('Error creando conversación:', createRes.status, t);
          return json(500, { error: 'Error creando conversación: ' + t });
        }
        const [conv] = await createRes.json();
        convId = conv.id;
      }
    }

    // Insertar el mensaje
    const msgRes = await fetch(`${SUPA_URL}/rest/v1/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'apikey': SERVICE_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        conversation_id: convId,
        sender_id: userId,
        body: msgBody.trim()
      })
    });
    if (!msgRes.ok) {
      const t = await msgRes.text();
      console.error('Error insertando mensaje:', msgRes.status, t);
      return json(500, { error: 'Error insertando mensaje: ' + t });
    }
    const [msg] = await msgRes.json();

    // Actualizar last_message y updated_at en la conversación
    await fetch(`${SUPA_URL}/rest/v1/conversations?id=eq.${convId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'apikey': SERVICE_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        last_message: msgBody.trim().slice(0, 100),
        updated_at: new Date().toISOString()
      })
    });

    return json(200, { message: msg, conversationId: convId });

  } catch (err) {
    console.error('send-message catch:', err.message, err.stack);
    return json(500, { error: err.message });
  }
};

const json = (s, d) => ({
  statusCode: s,
  headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  body: JSON.stringify(d)
});
