// netlify/functions/send-email.js
// Función universal para mandar emails con Brevo (API v3).
// Reutilizable desde cualquier otra function: stripe-webhook, send-message, create-reply, etc.
//
// USO:
//   const { sendEmail } = require('./send-email');
//   await sendEmail({
//     to: 'alguien@correo.com',
//     toName: 'Nombre Persona',
//     subject: 'Asunto del email',
//     htmlContent: '<h1>Hola</h1>...',
//     textContent: 'Hola...' // opcional, versión texto plano
//   });

const BREVO_API_KEY = process.env.BREVO_API_KEY;
const FROM_EMAIL = 'hola@he-sheknows.com';
const FROM_NAME = 'He Knows · She Knows';

/**
 * Envía un email vía Brevo.
 * Devuelve { ok: true/false, error?, messageId? }
 * NUNCA lanza excepción — si falla, lo registra y devuelve ok:false.
 * Así un email caído no rompe el flujo principal (ej: registrar pago).
 */
async function sendEmail({ to, toName, subject, htmlContent, textContent }) {
  if (!BREVO_API_KEY) {
    console.error('❌ BREVO_API_KEY no configurada en Netlify');
    return { ok: false, error: 'BREVO_API_KEY missing' };
  }
  if (!to || !subject || !htmlContent) {
    console.error('❌ sendEmail: faltan parámetros (to/subject/htmlContent)');
    return { ok: false, error: 'Missing parameters' };
  }

  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': BREVO_API_KEY,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        sender: { email: FROM_EMAIL, name: FROM_NAME },
        to: [{ email: to, name: toName || to }],
        subject,
        htmlContent,
        textContent: textContent || htmlContent.replace(/<[^>]+>/g, '')
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`❌ Brevo error ${res.status}:`, errText);
      return { ok: false, error: `Brevo ${res.status}: ${errText}` };
    }

    const data = await res.json();
    console.log(`✉️ Email enviado a ${to}: ${data.messageId}`);
    return { ok: true, messageId: data.messageId };
  } catch (err) {
    console.error('❌ sendEmail excepción:', err.message);
    return { ok: false, error: err.message };
  }
}

// ============================================================
// PLANTILLA: Nueva consulta pagada (para el advisor)
// ============================================================
function emailNuevaConsulta({ advisorName, userName, amount }) {
  const subject = '💰 Nueva consulta pagada — He Knows · She Knows';
  const htmlContent = `
<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#F7F3EE;font-family:'Helvetica Neue',Arial,sans-serif;color:#1A1410;">
<div style="max-width:600px;margin:0 auto;background:#FFFFFF;">

  <div style="padding:32px 32px 24px;border-bottom:1px solid #EDE7DF;text-align:center;">
    <div style="font-size:0.7rem;letter-spacing:0.28em;text-transform:uppercase;color:#1A1410;font-weight:300;">
      He Knows · <em style="color:#C47A5A;font-style:italic;">She Knows</em>
    </div>
  </div>

  <div style="padding:36px 32px 24px;">
    <h1 style="margin:0 0 16px;font-size:1.6rem;font-weight:400;color:#1A1410;">
      💰 Nueva consulta pagada
    </h1>
    <p style="margin:0 0 12px;font-size:1rem;line-height:1.6;color:#3D3530;">
      Hola <strong>${advisorName || 'advisor'}</strong>,
    </p>
    <p style="margin:0 0 20px;font-size:1rem;line-height:1.6;color:#3D3530;">
      ¡Tienes una nueva consulta! <strong>${userName || 'Un usuario'}</strong> ha pagado
      <strong>$${amount} MXN</strong> para conversar contigo.
    </p>

    <div style="background:#F7F3EE;border-left:3px solid #C47A5A;padding:16px 20px;margin:24px 0;">
      <p style="margin:0;font-size:0.95rem;color:#1A1410;">
        ⏱️ <strong>Tienes 24 horas</strong> para responder y conversar.
      </p>
    </div>

    <div style="text-align:center;margin:28px 0;">
      <a href="https://he-sheknows.com/mensajes" style="display:inline-block;background:#C47A5A;color:#FFFFFF;text-decoration:none;padding:14px 32px;font-size:0.85rem;letter-spacing:0.1em;text-transform:uppercase;border-radius:2px;">
        Ir a tu chat →
      </a>
    </div>
  </div>

  <div style="padding:24px 32px;background:#F7F3EE;border-top:1px solid #EDE7DF;">
    <p style="margin:0 0 14px;font-size:0.75rem;letter-spacing:0.18em;text-transform:uppercase;color:#C47A5A;font-weight:500;">
      Recuerda nuestras reglas
    </p>
    <p style="margin:0 0 12px;font-size:0.9rem;line-height:1.6;color:#3D3530;">
      He Knows · She Knows es un espacio seguro de perspectiva honesta. Como advisor:
    </p>
    <ul style="margin:0 0 12px;padding-left:20px;font-size:0.9rem;line-height:1.7;color:#3D3530;">
      <li><strong>Trata a la persona con respeto.</strong> Nunca ofendas, juzgues ni descalifiques.</li>
      <li><strong>No compartas tu WhatsApp, teléfono, correo ni redes sociales.</strong> Mantén la conversación dentro de la plataforma.</li>
      <li><strong>Tu rol es ayudar y dar perspectiva</strong>, no resolver ni dar consejos definitivos. Escucha primero.</li>
      <li><strong>Si recibes mensajes inapropiados</strong>, repórtalos desde el chat. Nosotros nos encargamos.</li>
    </ul>
    <p style="margin:12px 0 0;font-size:0.85rem;line-height:1.6;color:#9A8880;font-style:italic;">
      Romper estas reglas puede resultar en suspensión de tu cuenta.
    </p>
  </div>

  <div style="padding:20px 32px;text-align:center;background:#FFFFFF;border-top:1px solid #EDE7DF;">
    <p style="margin:0;font-size:0.75rem;color:#9A8880;">
      Gracias por ser parte de esta comunidad.
    </p>
    <p style="margin:6px 0 0;font-size:0.7rem;letter-spacing:0.18em;text-transform:uppercase;color:#1A1410;">
      He Knows · <em style="color:#C47A5A;">She Knows</em>
    </p>
  </div>

</div>
</body></html>`;

  const textContent = `
💰 Nueva consulta pagada — He Knows · She Knows

Hola ${advisorName || 'advisor'},

¡Tienes una nueva consulta! ${userName || 'Un usuario'} ha pagado $${amount} MXN para conversar contigo.

⏱️ Tienes 24 horas para responder y conversar.
→ Ir a tu chat: https://he-sheknows.com/mensajes

━━━━━━━━━━━━━━━━━━━━━━━
RECUERDA NUESTRAS REGLAS

He Knows · She Knows es un espacio seguro de perspectiva honesta. Como advisor:

✓ Trata a la persona con respeto. Nunca ofendas, juzgues ni descalifiques.
✓ No compartas tu WhatsApp, teléfono, correo ni redes sociales. Mantén la conversación dentro de la plataforma.
✓ Tu rol es ayudar y dar perspectiva, no resolver ni dar consejos definitivos. Escucha primero.
✓ Si recibes mensajes inapropiados, repórtalos desde el chat. Nosotros nos encargamos.

Romper estas reglas puede resultar en suspensión de tu cuenta.
━━━━━━━━━━━━━━━━━━━━━━━

Gracias por ser parte de esta comunidad.

He Knows · She Knows
`.trim();

  return { subject, htmlContent, textContent };
}

// ============================================================
// PLANTILLA: Nuevo mensaje en el chat
// ============================================================
function emailNuevoMensaje({ recipientName, senderName, preview, role }) {
  // role: 'advisor' = el destinatario es advisor, 'user' = es usuario
  const subject = `💬 Tienes un mensaje nuevo de ${senderName || 'alguien'} — He Knows · She Knows`;
  // Recortar preview por si es muy largo
  const previewCorto = (preview || '').slice(0, 140) + ((preview || '').length > 140 ? '...' : '');

  const htmlContent = `
<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#F7F3EE;font-family:'Helvetica Neue',Arial,sans-serif;color:#1A1410;">
<div style="max-width:600px;margin:0 auto;background:#FFFFFF;">

  <div style="padding:32px 32px 24px;border-bottom:1px solid #EDE7DF;text-align:center;">
    <div style="font-size:0.7rem;letter-spacing:0.28em;text-transform:uppercase;color:#1A1410;font-weight:300;">
      He Knows · <em style="color:#C47A5A;font-style:italic;">She Knows</em>
    </div>
  </div>

  <div style="padding:36px 32px 24px;">
    <h1 style="margin:0 0 16px;font-size:1.5rem;font-weight:400;color:#1A1410;">
      💬 Tienes un mensaje nuevo
    </h1>
    <p style="margin:0 0 12px;font-size:1rem;line-height:1.6;color:#3D3530;">
      Hola <strong>${recipientName || ''}</strong>,
    </p>
    <p style="margin:0 0 20px;font-size:1rem;line-height:1.6;color:#3D3530;">
      <strong>${senderName || 'Alguien'}</strong> te envió un mensaje:
    </p>

    <div style="background:#F7F3EE;border-left:3px solid #C47A5A;padding:16px 20px;margin:20px 0;">
      <p style="margin:0;font-size:0.95rem;line-height:1.5;color:#1A1410;font-style:italic;">
        "${previewCorto}"
      </p>
    </div>

    <div style="text-align:center;margin:28px 0;">
      <a href="https://he-sheknows.com/mensajes" style="display:inline-block;background:#C47A5A;color:#FFFFFF;text-decoration:none;padding:14px 32px;font-size:0.85rem;letter-spacing:0.1em;text-transform:uppercase;border-radius:2px;">
        Responder →
      </a>
    </div>

    <p style="margin:24px 0 0;font-size:0.85rem;line-height:1.5;color:#9A8880;text-align:center;">
      Recuerda: mantén la conversación dentro de la plataforma. No compartas datos de contacto.
    </p>
  </div>

  <div style="padding:20px 32px;text-align:center;background:#F7F3EE;border-top:1px solid #EDE7DF;">
    <p style="margin:0 0 6px;font-size:0.7rem;letter-spacing:0.18em;text-transform:uppercase;color:#1A1410;">
      He Knows · <em style="color:#C47A5A;">She Knows</em>
    </p>
    <p style="margin:0;font-size:0.7rem;color:#9A8880;">
      Recibiste este email porque tienes una conversación activa.
    </p>
  </div>

</div>
</body></html>`;

  const textContent = `
💬 Tienes un mensaje nuevo — He Knows · She Knows

Hola ${recipientName || ''},

${senderName || 'Alguien'} te envió un mensaje:

"${previewCorto}"

→ Responder: https://he-sheknows.com/mensajes

Recuerda: mantén la conversación dentro de la plataforma. No compartas datos de contacto.

He Knows · She Knows
`.trim();

  return { subject, htmlContent, textContent };
}

// ============================================================
// PLANTILLA: Nueva respuesta en Honest Talk
// ============================================================
function emailNuevaRespuestaHonest({ preview, postPreview }) {
  const subject = '🗨️ Tienes una respuesta nueva en Honest Talk — He Knows · She Knows';
  const previewCorto = (preview || '').slice(0, 160) + ((preview || '').length > 160 ? '...' : '');
  const postCorto = (postPreview || '').slice(0, 100) + ((postPreview || '').length > 100 ? '...' : '');

  const htmlContent = `
<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#F7F3EE;font-family:'Helvetica Neue',Arial,sans-serif;color:#1A1410;">
<div style="max-width:600px;margin:0 auto;background:#FFFFFF;">

  <div style="padding:32px 32px 24px;border-bottom:1px solid #EDE7DF;text-align:center;">
    <div style="font-size:0.7rem;letter-spacing:0.28em;text-transform:uppercase;color:#1A1410;font-weight:300;">
      He Knows · <em style="color:#C47A5A;font-style:italic;">She Knows</em>
    </div>
  </div>

  <div style="padding:36px 32px 24px;">
    <h1 style="margin:0 0 16px;font-size:1.5rem;font-weight:400;color:#1A1410;">
      🗨️ Tienes una respuesta nueva
    </h1>
    <p style="margin:0 0 20px;font-size:1rem;line-height:1.6;color:#3D3530;">
      Tu pregunta en Honest Talk recibió una respuesta nueva.
    </p>

    ${postCorto ? `
    <p style="margin:0 0 8px;font-size:0.75rem;letter-spacing:0.15em;text-transform:uppercase;color:#9A8880;">
      Tu pregunta
    </p>
    <p style="margin:0 0 20px;font-size:0.95rem;line-height:1.5;color:#3D3530;font-style:italic;">
      "${postCorto}"
    </p>
    ` : ''}

    <p style="margin:0 0 8px;font-size:0.75rem;letter-spacing:0.15em;text-transform:uppercase;color:#C47A5A;">
      Nueva respuesta
    </p>
    <div style="background:#F7F3EE;border-left:3px solid #C47A5A;padding:16px 20px;margin:0 0 24px;">
      <p style="margin:0;font-size:0.95rem;line-height:1.5;color:#1A1410;">
        "${previewCorto}"
      </p>
    </div>

    <div style="text-align:center;margin:28px 0;">
      <a href="https://he-sheknows.com/honest-talk" style="display:inline-block;background:#C47A5A;color:#FFFFFF;text-decoration:none;padding:14px 32px;font-size:0.85rem;letter-spacing:0.1em;text-transform:uppercase;border-radius:2px;">
        Ver respuesta completa →
      </a>
    </div>

    <p style="margin:24px 0 0;font-size:0.85rem;line-height:1.5;color:#9A8880;text-align:center;">
      ¿Quieres una respuesta privada y más profunda? Consulta a un advisor.
    </p>
  </div>

  <div style="padding:20px 32px;text-align:center;background:#F7F3EE;border-top:1px solid #EDE7DF;">
    <p style="margin:0 0 6px;font-size:0.7rem;letter-spacing:0.18em;text-transform:uppercase;color:#1A1410;">
      He Knows · <em style="color:#C47A5A;">She Knows</em>
    </p>
    <p style="margin:0;font-size:0.7rem;color:#9A8880;">
      Recibiste este email porque hiciste una pregunta en Honest Talk.
    </p>
  </div>

</div>
</body></html>`;

  const textContent = `
🗨️ Tienes una respuesta nueva en Honest Talk — He Knows · She Knows

Tu pregunta en Honest Talk recibió una respuesta nueva.

${postCorto ? `Tu pregunta:\n"${postCorto}"\n\n` : ''}Nueva respuesta:
"${previewCorto}"

→ Ver respuesta completa: https://he-sheknows.com/honest-talk

¿Quieres una respuesta privada y más profunda? Consulta a un advisor.

He Knows · She Knows
`.trim();

  return { subject, htmlContent, textContent };
}

// ============================================================
// PLANTILLA: Reporte de conversación (llega a admin del sitio)
// reporterRole: 'user' (un usuario reporta a un advisor) | 'advisor' (un advisor reporta a un usuario)
// ============================================================
function emailReporte({ reporterName, reporterEmail, reporterRole, reportedName, reportedEmail, reportedRole, motivo, conversationId, fecha }) {
  const tipoReporte = reporterRole === 'advisor' ? 'Advisor reporta a usuario' : 'Usuario reporta a advisor';
  const subject = `🚨 Reporte nuevo — ${tipoReporte}`;

  const htmlContent = `
<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#F7F3EE;font-family:'Helvetica Neue',Arial,sans-serif;color:#1A1410;">
<div style="max-width:600px;margin:0 auto;background:#FFFFFF;">

  <div style="padding:24px 32px;background:#1A1410;color:#FFFFFF;">
    <div style="font-size:0.7rem;letter-spacing:0.18em;text-transform:uppercase;color:#C9A96E;margin-bottom:6px;">
      Admin · He Knows · She Knows
    </div>
    <h1 style="margin:0;font-size:1.3rem;font-weight:400;">
      🚨 Nuevo reporte recibido
    </h1>
  </div>

  <div style="padding:28px 32px 20px;">
    <p style="margin:0 0 6px;font-size:0.75rem;letter-spacing:0.15em;text-transform:uppercase;color:#9A8880;">
      Tipo de reporte
    </p>
    <p style="margin:0 0 24px;font-size:1.05rem;font-weight:500;color:#C47A5A;">
      ${tipoReporte}
    </p>

    <table style="width:100%;border-collapse:collapse;margin:0 0 24px;">
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #EDE7DF;font-size:0.85rem;color:#9A8880;width:40%;">Quien reporta</td>
        <td style="padding:10px 0;border-bottom:1px solid #EDE7DF;font-size:0.9rem;color:#1A1410;">
          <strong>${reporterName || '(sin nombre)'}</strong><br>
          <span style="color:#9A8880;font-size:0.85rem;">${reporterEmail || ''} · ${reporterRole}</span>
        </td>
      </tr>
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #EDE7DF;font-size:0.85rem;color:#9A8880;">Persona reportada</td>
        <td style="padding:10px 0;border-bottom:1px solid #EDE7DF;font-size:0.9rem;color:#1A1410;">
          <strong>${reportedName || '(sin nombre)'}</strong><br>
          <span style="color:#9A8880;font-size:0.85rem;">${reportedEmail || ''} · ${reportedRole}</span>
        </td>
      </tr>
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #EDE7DF;font-size:0.85rem;color:#9A8880;">Fecha</td>
        <td style="padding:10px 0;border-bottom:1px solid #EDE7DF;font-size:0.9rem;color:#1A1410;">${fecha || ''}</td>
      </tr>
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #EDE7DF;font-size:0.85rem;color:#9A8880;">ID conversación</td>
        <td style="padding:10px 0;border-bottom:1px solid #EDE7DF;font-size:0.8rem;color:#1A1410;font-family:monospace;">${conversationId || '-'}</td>
      </tr>
    </table>

    <p style="margin:0 0 8px;font-size:0.75rem;letter-spacing:0.15em;text-transform:uppercase;color:#9A8880;">
      Motivo
    </p>
    <div style="background:#F7F3EE;border-left:3px solid #C47A5A;padding:16px 20px;margin:0 0 24px;">
      <p style="margin:0;font-size:0.95rem;line-height:1.5;color:#1A1410;${motivo ? '' : 'font-style:italic;color:#9A8880;'}">
        ${motivo || '(El usuario no escribió motivo)'}
      </p>
    </div>

    <p style="margin:0 0 16px;font-size:0.9rem;line-height:1.6;color:#3D3530;">
      <strong>Próximos pasos:</strong> Revisa el chat en Supabase usando el ID de la conversación.
      Decide si corresponde una advertencia, suspensión o ninguna acción.
    </p>
  </div>

  <div style="padding:20px 32px;background:#F7F3EE;border-top:1px solid #EDE7DF;text-align:center;">
    <p style="margin:0;font-size:0.7rem;color:#9A8880;">
      Este reporte se envió silenciosamente. Ninguna de las dos partes sabe que llegó a tu inbox.
    </p>
  </div>

</div>
</body></html>`;

  const textContent = `
🚨 NUEVO REPORTE — He Knows · She Knows

Tipo: ${tipoReporte}

Quien reporta:
  Nombre: ${reporterName || '(sin nombre)'}
  Email: ${reporterEmail || ''}
  Rol: ${reporterRole}

Persona reportada:
  Nombre: ${reportedName || '(sin nombre)'}
  Email: ${reportedEmail || ''}
  Rol: ${reportedRole}

Fecha: ${fecha || ''}
ID conversación: ${conversationId || '-'}

Motivo:
${motivo || '(El usuario no escribió motivo)'}

Próximos pasos: Revisa el chat en Supabase usando el ID de la conversación.

— Este reporte se envió silenciosamente. Ninguna de las dos partes sabe que llegó a tu inbox.
`.trim();

  return { subject, htmlContent, textContent };
}

// ============================================================
// PLANTILLA: Reporte de post o respuesta en Honest Talk
// kind: 'post' (pregunta) | 'reply' (respuesta)
// ============================================================
function emailReportePost({ kind, reporterName, reporterEmail, reporterRole, authorName, authorEmail, authorRole, contenido, motivo, itemId, postId, fecha }) {
  const tipoContenido = kind === 'reply' ? 'Respuesta' : 'Pregunta';
  const subject = `🚨 Reporte en Honest Talk — ${tipoContenido} reportada`;
  const contenidoCorto = (contenido || '').slice(0, 300) + ((contenido || '').length > 300 ? '...' : '');

  const htmlContent = `
<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#F7F3EE;font-family:'Helvetica Neue',Arial,sans-serif;color:#1A1410;">
<div style="max-width:600px;margin:0 auto;background:#FFFFFF;">

  <div style="padding:24px 32px;background:#1A1410;color:#FFFFFF;">
    <div style="font-size:0.7rem;letter-spacing:0.18em;text-transform:uppercase;color:#C9A96E;margin-bottom:6px;">
      Admin · He Knows · She Knows
    </div>
    <h1 style="margin:0;font-size:1.3rem;font-weight:400;">
      🚨 Reporte en Honest Talk
    </h1>
  </div>

  <div style="padding:28px 32px 20px;">
    <p style="margin:0 0 6px;font-size:0.75rem;letter-spacing:0.15em;text-transform:uppercase;color:#9A8880;">
      Tipo de contenido reportado
    </p>
    <p style="margin:0 0 24px;font-size:1.05rem;font-weight:500;color:#C47A5A;">
      ${tipoContenido} en Honest Talk
    </p>

    <p style="margin:0 0 8px;font-size:0.75rem;letter-spacing:0.15em;text-transform:uppercase;color:#9A8880;">
      Contenido reportado
    </p>
    <div style="background:#F7F3EE;border-left:3px solid #C47A5A;padding:16px 20px;margin:0 0 24px;">
      <p style="margin:0;font-size:0.95rem;line-height:1.5;color:#1A1410;font-style:italic;">
        "${contenidoCorto}"
      </p>
    </div>

    <table style="width:100%;border-collapse:collapse;margin:0 0 24px;">
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #EDE7DF;font-size:0.85rem;color:#9A8880;width:40%;">Autor del contenido</td>
        <td style="padding:10px 0;border-bottom:1px solid #EDE7DF;font-size:0.9rem;color:#1A1410;">
          <strong>${authorName || '(sin nombre)'}</strong><br>
          <span style="color:#9A8880;font-size:0.85rem;">${authorEmail || ''} · ${authorRole || ''}</span>
        </td>
      </tr>
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #EDE7DF;font-size:0.85rem;color:#9A8880;">Quien reporta</td>
        <td style="padding:10px 0;border-bottom:1px solid #EDE7DF;font-size:0.9rem;color:#1A1410;">
          <strong>${reporterName || '(sin nombre)'}</strong><br>
          <span style="color:#9A8880;font-size:0.85rem;">${reporterEmail || ''} · ${reporterRole || ''}</span>
        </td>
      </tr>
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #EDE7DF;font-size:0.85rem;color:#9A8880;">Fecha</td>
        <td style="padding:10px 0;border-bottom:1px solid #EDE7DF;font-size:0.9rem;color:#1A1410;">${fecha || ''}</td>
      </tr>
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #EDE7DF;font-size:0.85rem;color:#9A8880;">ID del ${kind === 'reply' ? 'reply' : 'post'}</td>
        <td style="padding:10px 0;border-bottom:1px solid #EDE7DF;font-size:0.8rem;color:#1A1410;font-family:monospace;">${itemId || '-'}</td>
      </tr>
      ${kind === 'reply' && postId ? `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #EDE7DF;font-size:0.85rem;color:#9A8880;">ID del post padre</td>
        <td style="padding:10px 0;border-bottom:1px solid #EDE7DF;font-size:0.8rem;color:#1A1410;font-family:monospace;">${postId}</td>
      </tr>
      ` : ''}
    </table>

    <p style="margin:0 0 8px;font-size:0.75rem;letter-spacing:0.15em;text-transform:uppercase;color:#9A8880;">
      Motivo del reporte
    </p>
    <div style="background:#FAFAF8;border:1px solid #EDE7DF;padding:16px 20px;margin:0 0 24px;border-radius:4px;">
      <p style="margin:0;font-size:0.95rem;line-height:1.5;color:#1A1410;${motivo ? '' : 'font-style:italic;color:#9A8880;'}">
        ${motivo || '(El usuario no escribió motivo)'}
      </p>
    </div>

    <p style="margin:0 0 16px;font-size:0.9rem;line-height:1.6;color:#3D3530;">
      <strong>Próximos pasos:</strong> Revisa el contenido en Supabase (tabla
      <code style="background:#F7F3EE;padding:2px 6px;border-radius:2px;font-size:0.85rem;">${kind === 'reply' ? 'post_replies' : 'posts'}</code>)
      usando el ID. Decide si corresponde borrar el contenido, advertir o suspender al autor.
    </p>
  </div>

  <div style="padding:20px 32px;background:#F7F3EE;border-top:1px solid #EDE7DF;text-align:center;">
    <p style="margin:0;font-size:0.7rem;color:#9A8880;">
      Reporte silencioso. El autor no sabe que su contenido fue reportado.
    </p>
  </div>

</div>
</body></html>`;

  const textContent = `
🚨 REPORTE EN HONEST TALK — He Knows · She Knows

Tipo: ${tipoContenido}

Contenido reportado:
"${contenidoCorto}"

Autor:
  Nombre: ${authorName || '(sin nombre)'}
  Email: ${authorEmail || ''}
  Rol: ${authorRole || ''}

Quien reporta:
  Nombre: ${reporterName || '(sin nombre)'}
  Email: ${reporterEmail || ''}
  Rol: ${reporterRole || ''}

Fecha: ${fecha || ''}
ID del ${kind === 'reply' ? 'reply' : 'post'}: ${itemId || '-'}
${kind === 'reply' && postId ? `ID del post padre: ${postId}\n` : ''}
Motivo:
${motivo || '(El usuario no escribió motivo)'}

Próximos pasos: Revisa en Supabase (tabla ${kind === 'reply' ? 'post_replies' : 'posts'}) usando el ID.

— Reporte silencioso. El autor no sabe que su contenido fue reportado.
`.trim();

  return { subject, htmlContent, textContent };
}

module.exports = { sendEmail, emailNuevaConsulta, emailNuevoMensaje, emailNuevaRespuestaHonest, emailReporte, emailReportePost };

// Handler vacío — este archivo es solo una librería, no un endpoint.
// Netlify requiere que toda función exporte un handler; aquí responde 404.
exports.handler = async () => ({
  statusCode: 404,
  body: 'This is a library, not an endpoint.'
});
