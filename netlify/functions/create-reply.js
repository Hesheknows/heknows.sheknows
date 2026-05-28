// netlify/functions/create-reply.js
// FIX: usar SERVICE_KEY para validar token (la anon_key no tiene permisos para verificar tokens de otros usuarios)
// v2: ahora envía email al autor del post cuando recibe respuesta nueva
const { sendEmail, emailNuevaRespuestaHonest } = require('./send-email');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json(200, {});
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method Not Allowed' });
  let body;
  try { body = JSON.parse(event.body); }
  catch { return json(400, { error: 'JSON invalido' }); }
  const { token, post_id, text, is_anonymous = false } = body;
  if (!token || !post_id || !text?.trim()) return json(400, { error: 'Faltan campos' });
  const SUPA_URL = 'https://ydqcxbwxfzyxdzidafch.supabase.co';
  const SERVICE_KEY = process.env.SUPABASE_SECRET_KEY;
  if (!SERVICE_KEY) {
    console.error('SUPABASE_SECRET_KEY no está configurada');
    return json(500, { error: 'Server misconfigured' });
  }
  // Verificar token usando SERVICE_KEY como apikey (no la anon_key)
  const userRes = await fetch(`${SUPA_URL}/auth/v1/user`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'apikey': SERVICE_KEY
    }
  });
  if (!userRes.ok) {
    const errText = await userRes.text();
    console.error('Token validation failed:', userRes.status, errText);
    return json(401, { error: 'Token invalido o expirado' });
  }
  const userData = await userRes.json();
  const userId = userData.id;
  if (!userId) {
    return json(401, { error: 'Usuario no encontrado' });
  }
  try {
    const replyRes = await fetch(`${SUPA_URL}/rest/v1/post_replies`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'apikey': SERVICE_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        post_id,
        user_id: userId,
        body: text.trim(),
        is_anonymous
      })
    });
    if (!replyRes.ok) {
      const t = await replyRes.text();
      console.error('Error creando reply:', replyRes.status, t);
      return json(500, { error: 'Error al responder: ' + t });
    }
    const [reply] = await replyRes.json();
    // Actualizar updated_at del post
    await fetch(`${SUPA_URL}/rest/v1/posts?id=eq.${post_id}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'apikey': SERVICE_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ updated_at: new Date().toISOString() })
    });

    // ============================================================
    // 📧 EMAIL AL AUTOR DEL POST
    // No bloqueante: si Brevo falla, la respuesta igual queda guardada.
    // No mandamos email si el autor se respondió a sí mismo.
    // ============================================================
    try {
      // Obtener autor del post + preview del post
      const postRes = await fetch(
        `${SUPA_URL}/rest/v1/posts?id=eq.${post_id}&select=user_id,body`,
        {
          headers: {
            'Authorization': `Bearer ${SERVICE_KEY}`,
            'apikey': SERVICE_KEY
          }
        }
      );
      const [post] = await postRes.json();

      if (!post) {
        console.warn('⚠️ Post no encontrado para enviar email:', post_id);
      } else if (post.user_id === userId) {
        console.log('Autor responde a su propio post — no se envía email');
      } else {
        // Obtener email del autor
        const profRes = await fetch(
          `${SUPA_URL}/rest/v1/profiles?id=eq.${post.user_id}&select=email,full_name`,
          {
            headers: {
              'Authorization': `Bearer ${SERVICE_KEY}`,
              'apikey': SERVICE_KEY
            }
          }
        );
        const [autor] = await profRes.json();

        if (autor?.email) {
          const tmpl = emailNuevaRespuestaHonest({
            preview: text.trim(),
            postPreview: post.body
          });
          await sendEmail({
            to: autor.email,
            toName: autor.full_name || '',
            subject: tmpl.subject,
            htmlContent: tmpl.htmlContent,
            textContent: tmpl.textContent
          });
          console.log(`📧 Email de nueva respuesta enviado a ${autor.email}`);
        } else {
          console.warn('⚠️ No se pudo obtener email del autor del post');
        }
      }
    } catch (emailErr) {
      console.error('❌ Error enviando email de respuesta (no crítico):', emailErr.message);
      // No re-lanzamos: la respuesta ya quedó guardada
    }

    return json(200, { reply });
  } catch (err) {
    console.error('create-reply error:', err);
    return json(500, { error: err.message });
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
