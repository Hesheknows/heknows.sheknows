// netlify/functions/get-replies.js
// Trae TODAS las respuestas de una pregunta de Honest Talk (con sus autores).
// Se usa cuando el usuario pica "ver las N respuestas".

exports.handler = async (event) => {
  const SUPA_URL = 'https://ydqcxbwxfzyxdzidafch.supabase.co';
  const SERVICE_KEY = process.env.SUPABASE_SECRET_KEY;

  const postId = (event.queryStringParameters || {}).post_id;
  if (!postId) return json(400, { error: 'Falta post_id' });

  const headers = { 'Authorization': `Bearer ${SERVICE_KEY}`, 'apikey': SERVICE_KEY };

  try {
    // Traer todas las respuestas de esa pregunta, en orden cronológico
    const repliesRes = await fetch(
      `${SUPA_URL}/rest/v1/post_replies?post_id=eq.${postId}&order=created_at.asc&select=id,body,is_anonymous,user_id,created_at,edited_at`,
      { headers }
    );
    if (!repliesRes.ok) {
      const t = await repliesRes.text();
      console.error('Error leyendo replies:', repliesRes.status, t);
      return json(500, { error: 'Error leyendo respuestas' });
    }
    const replies = await repliesRes.json();

    // Para cada respuesta, traer el autor (si no es anónima)
    const enriched = await Promise.all((replies || []).map(async (r) => {
      let author = null;
      if (r.user_id && !r.is_anonymous) {
        const pRes = await fetch(
          `${SUPA_URL}/rest/v1/profiles?id=eq.${r.user_id}&select=full_name,avatar_url,is_advisor,role`,
          { headers }
        );
        if (pRes.ok) {
          const pArr = await pRes.json();
          author = pArr[0] || null;
        }
      }
      return { ...r, author };
    }));

    return json(200, { replies: enriched });
  } catch (err) {
    console.error('get-replies error:', err.message);
    return json(500, { error: err.message });
  }
};

const json = (s, d) => ({
  statusCode: s,
  headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  body: JSON.stringify(d)
});
