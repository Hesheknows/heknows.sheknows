// netlify/functions/send-message.js
// POST { token, conversationId?, advisorId?, body }
// Si no existe conversationId, crea la conversación primero

const { createClient } = require('@supabase/supabase-js');

const sb = createClient(
  'https://ydqcxbwxfzyxdzidafch.supabase.co',
  process.env.SUPABASE_SECRET_KEY
);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  let body;
  try { body = JSON.parse(event.body); }
  catch { return json(400, { error: 'JSON inválido' }); }

  const { token, conversationId, advisorId, body: msgBody } = body;

  if (!token || !msgBody?.trim()) return json(400, { error: 'Faltan campos requeridos' });

  // Verificar sesión
  const { data: { user }, error: authErr } = await sb.auth.getUser(token);
  if (authErr || !user) return json(401, { error: 'No autorizado' });

  try {
    let convId = conversationId;

    // Si no hay conversación, crear una (o recuperar existente)
    if (!convId) {
      if (!advisorId) return json(400, { error: 'Se requiere advisorId o conversationId' });

      const { data: existing } = await sb.from('conversations')
        .select('id').eq('user_id', user.id).eq('advisor_id', advisorId).single();

      if (existing) {
        convId = existing.id;
      } else {
        const { data: created, error: convErr } = await sb.from('conversations')
          .insert({ user_id: user.id, advisor_id: advisorId }).select('id').single();
        if (convErr) throw convErr;
        convId = created.id;
      }
    }

    // Insertar mensaje
    const { data: msg, error: msgErr } = await sb.from('messages')
      .insert({ conversation_id: convId, sender_id: user.id, body: msgBody.trim() })
      .select().single();

    if (msgErr) throw msgErr;

    return json(200, { message: msg, conversationId: convId });
  } catch (err) {
    console.error('send-message error:', err);
    return json(500, { error: err.message });
  }
};

const json = (status, data) => ({
  statusCode: status,
  headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  body: JSON.stringify(data)
});
