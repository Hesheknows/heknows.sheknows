// netlify/functions/report-conversation.js
// Recibe un reporte (usuario → advisor, o advisor → usuario)
// y envía email al admin del sitio.
// Reporte SILENCIOSO: ninguna de las partes se entera de que se reportó.
const { sendEmail, emailReporte } = require('./send-email');

const ADMIN_EMAIL = 'heknows.sheknows23@gmail.com';

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json(200, {});
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method Not Allowed' });

  let body;
  try { body = JSON.parse(event.body); }
  catch { return json(400, { error: 'JSON inválido' }); }

  const { token, conversationId, motivo } = body;
  if (!token || !conversationId) {
    return json(400, { error: 'Faltan campos: token y conversationId' });
  }

  const SUPA_URL = 'https://ydqcxbwxfzyxdzidafch.supabase.co';
  const SERVICE_KEY = process.env.SUPABASE_SECRET_KEY;
  if (!SERVICE_KEY) {
    console.error('SUPABASE_SECRET_KEY no configurada');
    return json(500, { error: 'Server misconfigured' });
  }

  // 1. Validar quién reporta
  const userRes = await fetch(`${SUPA_URL}/auth/v1/user`, {
    headers: { 'Authorization': `Bearer ${token}`, 'apikey': SERVICE_KEY }
  });
  if (!userRes.ok) {
    return json(401, { error: 'Token inválido o expirado' });
  }
  const { id: reporterId } = await userRes.json();
  if (!reporterId) return json(401, { error: 'Usuario no encontrado' });

  try {
    // 2. Cargar conversación
    const convRes = await fetch(
      `${SUPA_URL}/rest/v1/conversations?id=eq.${conversationId}&select=id,user_id,advisor_id`,
      { headers: { 'Authorization': `Bearer ${SERVICE_KEY}`, 'apikey': SERVICE_KEY } }
    );
    const [conv] = await convRes.json();
    if (!conv) return json(404, { error: 'Conversación no encontrada' });

    // 3. Verificar que quien reporta participa
    if (reporterId !== conv.user_id && reporterId !== conv.advisor_id) {
      return json(403, { error: 'No participas en esta conversación' });
    }

    // 4. Identificar a quien se reporta (el otro participante)
    const reportedId = (reporterId === conv.user_id) ? conv.advisor_id : conv.user_id;
    const reporterRole = (reporterId === conv.advisor_id) ? 'advisor' : 'user';
    const reportedRole = (reporterId === conv.advisor_id) ? 'user' : 'advisor';

    // 5. Obtener perfiles (nombre + email) de ambas partes
    const profRes = await fetch(
      `${SUPA_URL}/rest/v1/profiles?id=in.(${reporterId},${reportedId})&select=id,email,full_name`,
      { headers: { 'Authorization': `Bearer ${SERVICE_KEY}`, 'apikey': SERVICE_KEY } }
    );
    const perfiles = await profRes.json();
    const reporter = perfiles.find(p => p.id === reporterId) || {};
    const reported = perfiles.find(p => p.id === reportedId) || {};

    // 6. Guardar el reporte en una tabla (opcional, para auditoría)
    // Si tienes una tabla `reports`, descomenta. Si no, este bloque hace nada.
    try {
      await fetch(`${SUPA_URL}/rest/v1/reports`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SERVICE_KEY}`,
          'apikey': SERVICE_KEY,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({
          reporter_id: reporterId,
          reported_id: reportedId,
          conversation_id: conversationId,
          motivo: (motivo || '').trim().slice(0, 1000),
          reporter_role: reporterRole,
          reported_role: reportedRole
        })
      });
      // NOTA: si la tabla `reports` no existe, Supabase devuelve 404/400
      // y no pasa nada (el catch lo absorbe).
    } catch (auditErr) {
      console.log('Tabla reports no existe o falló insert (no crítico):', auditErr.message);
    }

    // 7. Enviar email al admin
    const tmpl = emailReporte({
      reporterName: reporter.full_name || '(sin nombre)',
      reporterEmail: reporter.email || '',
      reporterRole,
      reportedName: reported.full_name || '(sin nombre)',
      reportedEmail: reported.email || '',
      reportedRole,
      motivo: (motivo || '').trim(),
      conversationId,
      fecha: new Date().toLocaleString('es-MX', { timeZone: 'America/Mexico_City' })
    });

    const result = await sendEmail({
      to: ADMIN_EMAIL,
      toName: 'Admin He Knows She Knows',
      subject: tmpl.subject,
      htmlContent: tmpl.htmlContent,
      textContent: tmpl.textContent
    });

    if (!result.ok) {
      console.error('No se pudo enviar email de reporte:', result.error);
      // Aun así devolvemos OK al usuario: no queremos que sepa si falló el email
    } else {
      console.log(`📧 Reporte enviado al admin sobre ${reported.email || reportedId}`);
    }

    return json(200, { ok: true });
  } catch (err) {
    console.error('report-conversation error:', err);
    // Devolvemos 200 igual: el usuario ve toast de "gracias" sin importar el error interno
    // (para no exponer detalles y mantener UX silenciosa)
    return json(200, { ok: true });
  }
};

const json = (s, d) => ({
  statusCode: s,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  },
  body: JSON.stringify(d)
});
