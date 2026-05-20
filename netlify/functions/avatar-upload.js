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
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Faltan datos' }) };
    }

    // Convertir base64 a buffer
    const buffer = Buffer.from(fileBase64, 'base64');

    // Siempre guardar como jpg para evitar problemas con heic/heif
    const path = `${userId}.jpg`;
    const contentType = 'image/jpeg';

    // Subir a Supabase Storage
    const uploadRes = await fetch(`${SUPABASE_URL}/storage/v1/object/avatars/${path}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'apikey': SUPABASE_KEY,
        'Content-Type': contentType,
        'x-upsert': 'true'
      },
      body: buffer
    });

    if (!uploadRes.ok) {
      const err = await uploadRes.text();
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Error subiendo foto: ' + err }) };
    }

    const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/avatars/${path}`;

    // Actualizar avatar_url en profiles
    await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'apikey': SUPABASE_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ avatar_url: publicUrl })
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, url: publicUrl })
    };

  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
