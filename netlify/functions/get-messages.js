// netlify/functions/get-messages.js
// GET ?token=...&conversationId=...&markRead=true

const { createClient } = require('@supabase/supabase-js');

const sb = createClient(
  'https://ydqcxbwxfzyxdzidafch.supabase.co',
  process.env.SUPABASE_SECRET_KEY
);

exports.handler = async (event) => {
  const { token, conversationId, markRead } = event.queryStringParameters || {};

  if (!token || !conversationId) return json(400, { error: 'Faltan parámetros' });

  const { data: { user }, error: authErr } = await sb.auth.getUser(token);
  if (authErr || !user) return json(401, { error: 'No autorizado' });

  try {
    const { data: messages, error } = await sb.from('messages')
      .select('id, body, sender_id, created_at, read')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    if (markRead === 'true') {
      await sb.rpc('mark_read', { p_conversation_id: conversationId, p_reader_id: user.id });
    }

    return json(200, { messages, userId: user.id });
  } catch (err) {
    console.error('get-messages error:', err);
    return json(500, { error: err.message });
  }
};

const json = (status, data) => ({
  statusCode: status,
  headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  body: JSON.stringify(data)
});
