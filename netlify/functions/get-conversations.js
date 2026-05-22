// netlify/functions/get-conversations.js
exports.handler = async (event) => {
  const { token } = event.queryStringParameters || {};
  if (!token) return json(400, { error: 'Token requerido' });

  const URL = 'https://ydqcxbwxfzyxdzidafch.supabase.co';
  const SERVICE_KEY = process.env.SUPABASE_SECRET_KEY;
  const ANON_KEY = 'sb_publishable_6LRVFCwHqtf0r9daHpqbLg_oH9VTpRA';

  const userRes = await fetch(`${URL}/auth/v1/user`, {
    headers: { 'Authorization': `Bearer ${token}`, 'apikey': ANON_KEY }
  });
  if (!userRes.ok) return json(401, { error: 'No autorizado' });
  const { id: userId } = await userRes.json();

  try {
    const convsRes = await fetch(`${URL}/rest/v1/conversations?or=(user_id.eq.${userId},advisor_id.eq.${userId})&order=updated_at.desc&select=id,last_message,updated_at,unread_user,unread_advisor,user_id,advisor_id`, {
      headers: { 'Authorization': `Bearer ${SERVICE_KEY}`, 'apikey': SERVICE_KEY }
    });
    const convs = await convsRes.json();

    const result = await Promise.all((convs || []).map(async c => {
      const isAdvisor = c.advisor_id === userId;
      const otherId = isAdvisor ? c.user_id : c.advisor_id;
      const profRes = await fetch(`${URL}/rest/v1/profiles?id=eq.${otherId}&select=id,full_name,avatar_url`, {
        headers: { 'Authorization': `Bearer ${SERVICE_KEY}`, 'apikey': SERVICE_KEY }
      });
      const [other] = await profRes.json();
      return { id: c.id, other: other || {}, last_message: c.last_message, updated_at: c.updated_at, unread: isAdvisor ? c.unread_advisor : c.unread_user, role: isAdvisor ? 'advisor' : 'user' };
    }));

    return json(200, { conversations: result, userId });
  } catch (err) {
    return json(500, { error: err.message });
  }
};
const json = (s, d) => ({ statusCode: s, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(d) });
