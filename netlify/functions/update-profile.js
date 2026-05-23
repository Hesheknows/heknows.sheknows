exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method Not Allowed' });
  let body;
  try { body = JSON.parse(event.body); }
  catch { return json(400, { error: 'JSON inválido' }); }
  const { token, full_name, bio, city, country, gender, is_anonymous } = body;
  if (!token) return json(400, { error: 'Token requerido' });

  const URL = 'https://ydqcxbwxfzyxdzidafch.supabase.co';
  const SERVICE_KEY = process.env.SUPABASE_SECRET_KEY;
  const ANON_KEY = 'sb_publishable_6LRVFCwHqtf0r9daHpqbLg_oH9VTpRA';

  const userRes = await fetch(`${URL}/auth/v1/user`, {
    headers: { 'Authorization': `Bearer ${token}`, 'apikey': ANON_KEY }
  });
  if (!userRes.ok) return json(401, { error: 'No autorizado' });
  const userData = await userRes.json();
  if (!userData.id) return json(401, { error: 'Usuario no encontrado' });

  const updateRes = await fetch(`${URL}/rest/v1/profiles?id=eq.${userData.id}`, {
    method: 'PATCH',
    headers: { 'Authorization': `Bearer ${SERVICE_KEY}`, 'apikey': SERVICE_KEY, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
    body: JSON.stringify({ full_name, bio, city, country, gender, is_anonymous: !!is_anonymous })
  });
  if (!updateRes.ok) return json(500, { error: 'Error al actualizar' });
  return json(200, { ok: true });
};
const json = (s, d) => ({ statusCode: s, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(d) });
