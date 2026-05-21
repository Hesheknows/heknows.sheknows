// netlify/functions/get-conversations.js
// GET ?token=...
// Devuelve todas las conversaciones del usuario (como user o como advisor)
// con datos del otro participante

const { createClient } = require('@supabase/supabase-js');

const sb = createClient(
  'https://ydqcxbwxfzyxdzidafch.supabase.co',
  process.env.SUPABASE_SECRET_KEY
);

exports.handler = async (event) => {
  const { token } = event.queryStringParameters || {};
  if (!token) return json(400, { error: 'Token requerido' });

  const { data: { user }, error: authErr } = await sb.auth.getUser(token);
  if (authErr || !user) return json(401, { error: 'No autorizado' });

  try {
    const { data: convs, error } = await sb.from('conversations')
      .select(`
        id, last_message, updated_at, unread_user, unread_advisor,
        user:profiles!conversations_user_id_fkey(id, full_name, avatar_url),
        advisor:profiles!conversations_advisor_id_fkey(id, full_name, avatar_url)
      `)
      .or(`user_id.eq.${user.id},advisor_id.eq.${user.id}`)
      .order('updated_at', { ascending: false });

    if (error) throw error;

    const result = (convs || []).map(c => {
      const isAdvisor = c.advisor?.id === user.id;
      const other = isAdvisor ? c.user : c.advisor;
      const unread = isAdvisor ? c.unread_advisor : c.unread_user;
      return {
        id: c.id,
        other,
        last_message: c.last_message,
        updated_at: c.updated_at,
        unread,
        role: isAdvisor ? 'advisor' : 'user'
      };
    });

    return json(200, { conversations: result, userId: user.id });
  } catch (err) {
    console.error('get-conversations error:', err);
    return json(500, { error: err.message });
  }
};

const json = (status, data) => ({
  statusCode: status,
  headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  body: JSON.stringify(data)
});
