// netlify/functions/update-content.js
// Edita un POST o un REPLY en Honest Talk.
// Solo el autor puede editar su propio contenido.
// Marca edited_at = now() para mostrar "(editado)".
exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json(200, {});
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method Not Allowed' });

  let body;
  try { body = JSON.parse(event.body); }
  catch { return json(400, { error: 'JSON inválido' }); }

  // kind: 'post' | 'reply'
  const { token, kind, itemId, text } = body;
  if (!token || !kind || !itemId || !text?.trim()) {
    return json(400, { error: 'Faltan campos: token, kind, itemId, text' });
  }
  if (kind !== 'post' && kind !== 'reply') {
    return json(400, { error: 'kind debe ser "post" o "reply"' });
  }
  if (text.trim().length > 2000) {
    return json(400, { error: 'Texto demasiado largo (máx 2000 caracteres)' });
  }

  const SUPA_URL = 'https://ydqcxbwxfzyxdzidafch.supabase.co';
  const SERVICE_KEY = process.env.SUPABASE_SECRET_KEY;
  if (!SERVICE_KEY) {
    console.error('SUPABASE_SECRET_KEY no configurada');
    return json(500, { error: 'Server misconfigured' });
  }

  // 1. Validar token
  const userRes = await fetch(`${SUPA_URL}/auth/v1/user`, {
    headers: { 'Authorization': `Bearer ${token}`, 'apikey': SERVICE_KEY }
  });
  if (!userRes.ok) return json(401, { error: 'Token inválido o expirado' });
  const { id: userId } = await userRes.json();
  if (!userId) return json(401, { error: 'Usuario no encontrado' });

  try {
    const table = kind === 'reply' ? 'post_replies' : 'posts';

    // 2. Verificar que el contenido existe y es del usuario
    const checkRes = await fetch(
      `${SUPA_URL}/rest/v1/${table}?id=eq.${itemId}&select=id,user_id${kind === 'post' ? ',is_deleted' : ''}`,
      { headers: { 'Authorization': `Bearer ${SERVICE_KEY}`, 'apikey': SERVICE_KEY } }
    );
    const [item] = await checkRes.json();
    if (!item) return json(404, { error: 'Contenido no encontrado' });
    if (item.user_id !== userId) return json(403, { error: 'No puedes editar contenido ajeno' });
    if (kind === 'post' && item.is_deleted) return json(400, { error: 'No puedes editar un post eliminado' });

    // 3. Actualizar body + edited_at
    const updateRes = await fetch(
      `${SUPA_URL}/rest/v1/${table}?id=eq.${itemId}`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${SERVICE_KEY}`,
          'apikey': SERVICE_KEY,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          body: text.trim(),
          edited_at: new Date().toISOString()
        })
      }
    );

    if (!updateRes.ok) {
      const t = await updateRes.text();
      console.error('Error actualizando:', updateRes.status, t);
      return json(500, { error: 'No se pudo actualizar el contenido' });
    }

    const [updated] = await updateRes.json();
    return json(200, { ok: true, item: updated });
  } catch (err) {
    console.error('update-content error:', err);
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
