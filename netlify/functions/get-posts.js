// netlify/functions/get-posts.js
// v2: incluye edited_at e is_deleted en posts, y edited_at en replies
//     (para que el frontend pueda mostrar "editado", "[eliminada]" y los menús dinámicos)
exports.handler = async (event) => {
  const { category, limit = 20, offset = 0 } = event.queryStringParameters || {};
  const SUPA_URL = 'https://ydqcxbwxfzyxdzidafch.supabase.co';
  const SERVICE_KEY = process.env.SUPABASE_SECRET_KEY;
  const ANON_KEY = 'sb_publishable_6LRVFCwHqtf0r9daHpqbLg_oH9VTpRA';
  try {
    // Agregadas las columnas edited_at e is_deleted
    let url = `${SUPA_URL}/rest/v1/posts?order=created_at.desc&limit=${limit}&offset=${offset}&select=id,body,is_anonymous,category,likes,created_at,user_id,edited_at,is_deleted`;
    if (category && category !== 'all') {
      url += `&category=eq.${category}`;
    }
    const postsRes = await fetch(url, {
      headers: { 'Authorization': `Bearer ${SERVICE_KEY}`, 'apikey': SERVICE_KEY }
    });
    const posts = await postsRes.json();
    // Para cada post, traer el perfil del autor (si no es anonimo) y el conteo de replies
    const enriched = await Promise.all((posts || []).map(async (post) => {
      let author = null;
      if (!post.is_anonymous && post.user_id) {
        const profRes = await fetch(
          `${SUPA_URL}/rest/v1/profiles?id=eq.${post.user_id}&select=full_name,avatar_url`,
          { headers: { 'Authorization': `Bearer ${SERVICE_KEY}`, 'apikey': SERVICE_KEY } }
        );
        const profData = await profRes.json();
        author = profData[0] || null;
      }
      // Contar replies
      const repliesRes = await fetch(
        `${SUPA_URL}/rest/v1/post_replies?post_id=eq.${post.id}&select=id`,
        { headers: { 'Authorization': `Bearer ${SERVICE_KEY}`, 'apikey': SERVICE_KEY } }
      );
      const replies = await repliesRes.json();
      // Traer primera reply visible (ahora incluye edited_at)
      const firstReplyRes = await fetch(
        `${SUPA_URL}/rest/v1/post_replies?post_id=eq.${post.id}&order=created_at.asc&limit=1&select=id,body,is_anonymous,user_id,created_at,edited_at`,
        { headers: { 'Authorization': `Bearer ${SERVICE_KEY}`, 'apikey': SERVICE_KEY } }
      );
      const firstReplyData = await firstReplyRes.json();
      let firstReply = firstReplyData[0] || null;
      if (firstReply && firstReply.user_id) {
        const rProfRes = await fetch(
          `${SUPA_URL}/rest/v1/profiles?id=eq.${firstReply.user_id}&select=full_name,avatar_url,is_advisor,role`,
          { headers: { 'Authorization': `Bearer ${SERVICE_KEY}`, 'apikey': SERVICE_KEY } }
        );
        const rProf = await rProfRes.json();
        firstReply.author = rProf[0] || null;
      }
      return {
        ...post,
        author,
        reply_count: replies.length,
        first_reply: firstReply
      };
    }));
    return json(200, { posts: enriched });
  } catch (err) {
    console.error('get-posts error:', err);
    return json(500, { error: err.message });
  }
};
const json = (s, d) => ({
  statusCode: s,
  headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  body: JSON.stringify(d)
});
