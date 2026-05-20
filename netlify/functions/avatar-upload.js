// netlify/functions/avatar-upload.js

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  };

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const SUPABASE_URL = 'https://ydqcxbwxfzyxdzidafch.supabase.co';
  const SUPABASE_KEY = 'sb_secret_-rYCDZ5-BMzP13bDqvJtTg_FmtYp-7E';

  try {
    const { userId, fileBase64, fileName, fileType } = JSON.parse(event.body);

    if (!userId || !fileBase64) {
      return { statusCode: 200, headers, body: JSON.stringify({ error: 'Faltan datos: userId=' + userId }) };
    }

    const buffer = Buffer.from(fileBase64, 'base64');
    const path = `${userId}.jpg`;

    const uploadRes = await fetch(`${SUPABASE_URL}/storage/v1/object/avatars/${path}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'apikey': SUPABASE_KEY,
        'Content-Type': 'image/jpeg',
        'x-upsert': 'true'
      },
      body: buffer
    });

    const uploadText = await uploadRes.text();

    if (!uploadRes.ok) {
      return { 
        statusCode: 200, 
        headers, 
        body: JSON.stringify({ 
          error: 'Supabase Storage error ' + uploadRes.status + ': ' + uploadText,
          path: path,
          userId: userId
        }) 
      };
    }

    const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/avatars/${path}`;

    // Actualizar avatar_url en profiles
    const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'apikey': SUPABASE_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ avatar_url: publicUrl })
    });

    if (!patchRes.ok) {
      const patchErr = await patchRes.text();
      return { statusCode: 200, headers, body: JSON.stringify({ error: 'Error guardando URL: ' + patchErr }) };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, url: publicUrl })
    };

  } catch (err) {
    return { statusCode: 200, headers, body: JSON.stringify({ error: 'Exception: ' + err.message }) };
  }
};
