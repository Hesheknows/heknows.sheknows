exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method Not Allowed' });

  let body;
  try { body = JSON.parse(event.body); }
  catch { return json(400, { error: 'JSON inválido' }); }

  const { token, full_name, bio, city, gender, is_anonymous } = body;
  if (!token) return json(400, { error: 'Token requerido' });

  const SUPABASE_URL = 'https://ydqcxbwxfzyxdzidafch.supabase.co';
  const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY;

  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { 'Authorization': `Bearer ${token}`, 'apikey': SUPABASE_KEY }
  });
  const userData = await userRes.json();
  if (!userData.id) return json(401, { error: 'No autorizado' });

  const updateRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userData.id}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'apikey': SUPABASE_KEY,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify({ full_name, bio, city, gender, is_anonymous: !!is_anonymous })
  });

  if (!updateRes.ok) return json(500, { error: 'Error al actualizar' });
  return json(200, { ok: true });
};

const json = (status, data) => ({
  statusCode: status,
  headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  body: JSON.stringify(data)
});
