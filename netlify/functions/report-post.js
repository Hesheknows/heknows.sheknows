// netlify/functions/report-post.js
// Recibe un reporte de un POST o REPLY en Honest Talk
// y envía email al admin del sitio.
// Reporte SILENCIOSO: el autor no sabe que fue reportado.
const { sendEmail, emailReportePost } = require('./send-email');

const ADMIN_EMAIL = 'heknows.sheknows23@gmail.com';

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json(200, {});
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method Not Allowed' });

  let body;
  try { body = JSON.parse(event.body); }
  catch { return json(400, { error: 'JSON inválido' }); }

  // kind: 'post' | 'reply'
  const { token, kind, itemId, motivo } = body;
  if (!token || !kind || !itemId) {
    return json(400, { error: 'Faltan campos: token, kind, itemId' });
  }
  if (kind !== 'post' && kind !== 'reply') {
    return json(400, { error: 'kind debe ser "post" o "reply"' });
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
  if (!userRes.ok) return json(401, { error: 'Token inválido o expirado' });
  const { id: reporterId } = await userRes.json();
  if (!reporterId) return json(401, { error: 'Usuario no encontrado' });

  try {
    // 2. Cargar el item reportado (post o reply)
    const table = kind === 'reply' ? 'post_replies' : 'posts';
    const fields = kind === 'reply' ? 'id,user_id,body,post_id' : 'id,user_id,body';
    const itemRes = await fetch(
      `${SUPA_URL}/rest/v1/${table}?id=eq.${itemId}&select=${fields}`,
      { headers: { 'Authorization': `Bearer ${SERVICE_KEY}`, 'apikey': SERVICE_KEY } }
    );
    const [item] = await itemRes.json();
    if (!item) return json(404, { error: 'Contenido no encontrado' });

    const authorId = item.user_id;

    // 3. Obtener perfiles (nombre + email + role) de ambas partes
    const profRes = await fetch(
      `${SUPA_URL}/rest/v1/profiles?id=in.(${reporterId},${authorId})&select=id,email,full_name,role`,
      { headers: { 'Authorization': `Bearer ${SERVICE_KEY}`, 'apikey': SERVICE_KEY } }
    );
    const perfiles = await profRes.json();
    const reporter = perfiles.find(p => p.id === reporterId) || {};
    const author = perfiles.find(p => p.id === authorId) || {};

    // 4. Guardar el reporte en una tabla (opcional, para auditoría)
    try {
      await fetch(`${SUPA_URL}/rest/v1/post_reports`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SERVICE_KEY}`,
          'apikey': SERVICE_KEY,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({
          reporter_id: reporterId,
          author_id: authorId,
          kind,
          item_id: itemId,
          post_id: kind === 'reply' ? item.post_id : itemId,
          motivo: (motivo || '').trim().slice(0, 1000)
        })
      });
    } catch (auditErr) {
      console.log('Tabla post_reports no existe o falló insert (no crítico):', auditErr.message);
    }

    // 5. Enviar email al admin
    const tmpl = emailReportePost({
      kind,
      reporterName: reporter.full_name || '(sin nombre)',
      reporterEmail: reporter.email || '',
      reporterRole: reporter.role || 'user',
      authorName: author.full_name || '(sin nombre)',
      authorEmail: author.email || '',
      authorRole: author.role || 'user',
      contenido: item.body || '',
      motivo: (motivo || '').trim(),
      itemId,
      postId: kind === 'reply' ? item.post_id : null,
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
    } else {
      console.log(`📧 Reporte de Honest Talk (${kind}) enviado al admin`);
    }

    return json(200, { ok: true });
  } catch (err) {
    console.error('report-post error:', err);
    // Devolvemos 200 igual: UX silenciosa, el usuario ve "gracias" siempre
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
