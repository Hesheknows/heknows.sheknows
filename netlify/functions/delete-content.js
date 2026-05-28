// netlify/functions/delete-content.js
// Borra un POST o un REPLY en Honest Talk.
// Solo el autor puede borrar su propio contenido.
//
// LÓGICA INTELIGENTE PARA POSTS:
//   - Si el post tiene respuestas → SOFT DELETE (is_deleted=true, conserva respuestas)
//   - Si NO tiene respuestas → HARD DELETE (desaparece completo)
//
// LÓGICA PARA REPLIES:
//   - Siempre HARD DELETE (no rompen nada, simplemente desaparecen).
exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json(200, {});
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method Not Allowed' });

  let body;
  try { body = JSON.parse(event.body); }
  catch { return json(400, { error: 'JSON inválido' }); }

  const { token, kind, itemId } = body;
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
      `${SUPA_URL}/rest/v1/${table}?id=eq.${itemId}&select=id,user_id`,
      { headers: { 'Authorization': `Bearer ${SERVICE_KEY}`, 'apikey': SERVICE_KEY } }
    );
    const [item] = await checkRes.json();
    if (!item) return json(404, { error: 'Contenido no encontrado' });
    if (item.user_id !== userId) return json(403, { error: 'No puedes borrar contenido ajeno' });

    // 3. Lógica según tipo
    if (kind === 'reply') {
      // REPLIES: borrado fuerte
      const delRes = await fetch(
        `${SUPA_URL}/rest/v1/post_replies?id=eq.${itemId}`,
        {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${SERVICE_KEY}`, 'apikey': SERVICE_KEY }
        }
      );
      if (!delRes.ok) {
        const t = await delRes.text();
        console.error('Error borrando reply:', delRes.status, t);
        return json(500, { error: 'No se pudo borrar la respuesta' });
      }
      return json(200, { ok: true, mode: 'hard_deleted' });
    }

    // POSTS: verificar si tiene respuestas
    const repliesRes = await fetch(
      `${SUPA_URL}/rest/v1/post_replies?post_id=eq.${itemId}&select=id&limit=1`,
      { headers: { 'Authorization': `Bearer ${SERVICE_KEY}`, 'apikey': SERVICE_KEY } }
    );
    const replies = await repliesRes.json();
    const tieneRespuestas = Array.isArray(replies) && replies.length > 0;

    if (tieneRespuestas) {
      // SOFT DELETE: marcar is_deleted, dejar respuestas intactas
      const updateRes = await fetch(
        `${SUPA_URL}/rest/v1/posts?id=eq.${itemId}`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${SERVICE_KEY}`,
            'apikey': SERVICE_KEY,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ is_deleted: true })
        }
      );
      if (!updateRes.ok) {
        const t = await updateRes.text();
        console.error('Error soft-delete post:', updateRes.status, t);
        return json(500, { error: 'No se pudo eliminar el post' });
      }
      return json(200, { ok: true, mode: 'soft_deleted' });
    } else {
      // HARD DELETE: borrar completo
      const delRes = await fetch(
        `${SUPA_URL}/rest/v1/posts?id=eq.${itemId}`,
        {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${SERVICE_KEY}`, 'apikey': SERVICE_KEY }
        }
      );
      if (!delRes.ok) {
        const t = await delRes.text();
        console.error('Error hard-delete post:', delRes.status, t);
        return json(500, { error: 'No se pudo borrar el post' });
      }
      return json(200, { ok: true, mode: 'hard_deleted' });
    }
  } catch (err) {
    console.error('delete-content error:', err);
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
