// netlify/functions/send-message.js
const { sendEmail, emailNuevoMensaje } = require('./send-email');

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
    // Aplicar censura de contactos antes de guardar
    const { texto: bodyLimpio, censurado } = censurarContactos(msgBody.trim());

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
        body: bodyLimpio
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
        last_message: bodyLimpio.slice(0, 100),
        updated_at: new Date().toISOString()
      })
    });

    // ============================================================
    // 📧 EMAIL DE NUEVO MENSAJE (con throttling de 1 hora)
    // Lógica: solo mandar email si no hubo otro mensaje en la última hora.
    // Así no saturamos a la gente cuando conversan en vivo, pero sí avisamos
    // si pasó tiempo de silencio.
    // No bloqueante: si Brevo falla, el mensaje igual queda guardado.
    // ============================================================
    try {
      const hace1hISO = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      // Buscar mensajes anteriores en esta conversación dentro de la última hora,
      // EXCLUYENDO el mensaje que acabamos de insertar
      const prevRes = await fetch(
        `${SUPA_URL}/rest/v1/messages?conversation_id=eq.${convId}&created_at=gt.${hace1hISO}&id=neq.${msg.id}&select=id`,
        {
          headers: {
            'Authorization': `Bearer ${SERVICE_KEY}`,
            'apikey': SERVICE_KEY,
            'Prefer': 'count=exact'
          }
        }
      );
      const prevMensajes = await prevRes.json();
      const huboActividadReciente = Array.isArray(prevMensajes) && prevMensajes.length > 0;

      if (!huboActividadReciente) {
        // Pasó >1h de silencio (o es el primer mensaje): enviar email
        const recipientId = (userId === convUserId) ? convAdvisorId : convUserId;

        // Obtener email + nombre del destinatario y nombre del que envía
        const profRes = await fetch(
          `${SUPA_URL}/rest/v1/profiles?id=in.(${recipientId},${userId})&select=id,email,full_name`,
          { headers: { 'Authorization': `Bearer ${SERVICE_KEY}`, 'apikey': SERVICE_KEY } }
        );
        const perfiles = await profRes.json();
        const recipient = perfiles.find(p => p.id === recipientId);
        const sender = perfiles.find(p => p.id === userId);

        if (recipient?.email) {
          const tmpl = emailNuevoMensaje({
            recipientName: recipient.full_name || '',
            senderName: sender?.full_name || 'Alguien',
            preview: bodyLimpio,
            role: (recipientId === convAdvisorId) ? 'advisor' : 'user'
          });
          await sendEmail({
            to: recipient.email,
            toName: recipient.full_name,
            subject: tmpl.subject,
            htmlContent: tmpl.htmlContent,
            textContent: tmpl.textContent
          });
          console.log(`📧 Email de nuevo mensaje enviado a ${recipient.email}`);
        }
      } else {
        console.log('Throttle: hubo mensajes en la última hora, no se envía email');
      }
    } catch (emailErr) {
      console.error('❌ Error enviando email de mensaje (no crítico):', emailErr.message);
      // No re-lanzamos: el mensaje ya quedó guardado, el email es secundario
    }

    return json(200, { message: msg, conversationId: convId, censurado });

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

// ============================================================
// CENSURA DE CONTACTOS
// Reemplaza teléfonos, emails y menciones de redes/contacto
// por [oculto]. Protege la comisión de la plataforma evitando
// que usuarios y advisors se vayan por fuera.
// Devuelve { texto, censurado:true/false }
// ============================================================
function censurarContactos(texto) {
  let t = texto;
  let hubo = false;
  const marca = () => { hubo = true; return '[oculto]'; };

  // 1) Emails  ej: alguien@correo.com
  t = t.replace(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g, marca);

  // 2) URLs / enlaces  ej: wa.me/52..., t.me/..., http...
  t = t.replace(/(https?:\/\/|www\.)[^\s]+/gi, marca);
  t = t.replace(/\b(wa\.me|t\.me|bit\.ly|instagram\.com|fb\.com|facebook\.com)\/[^\s]*/gi, marca);

  // 3) Teléfonos: secuencias con 7+ dígitos, permitiendo +, espacios, guiones, paréntesis y puntos
  //    ej: 5512345678, +52 55 1234 5678, 55-1234-5678, (55) 1234.5678
  t = t.replace(/(\+?\d[\d\s().\-]{6,}\d)/g, (m) => {
    const soloDigitos = m.replace(/\D/g, '');
    return soloDigitos.length >= 7 ? marca() : m;
  });

  // 4) Palabras clave de contacto / redes sociales
  const palabras = [
    'whatsapp', 'whats app', 'whatsap', 'wsp', 'wpp', 'whats',
    'telegram', 'telegrama',
    'instagram', 'insta', 'ig',
    'facebook', 'face', 'fb', 'messenger',
    'tiktok', 'tik tok',
    'snapchat', 'snap',
    'mi numero', 'mi número', 'mi cel', 'mi celular', 'mi telefono', 'mi teléfono', 'mi correo', 'mi mail',
    'llamame', 'llámame', 'marcame', 'márcame', 'escribeme', 'escríbeme',
    'mi whats', 'mi wpp', 'mi ig', 'mi insta'
  ];
  for (const p of palabras) {
    const re = new RegExp('\\b' + p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'gi');
    t = t.replace(re, marca);
  }

  return { texto: t.trim(), censurado: hubo };
}
