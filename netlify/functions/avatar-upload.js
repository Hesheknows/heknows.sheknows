// netlify/functions/avatar-upload.js
exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const SUPABASE_URL = 'https://ydqcxbwxfzyxdzidafch.supabase.co';
  const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY;
  const BUCKET = 'Avatars'; // mayúscula como está creado en Supabase

  if (!SUPABASE_KEY) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'SUPABASE_SECRET_KEY no configurada en Netlify' }) };
  }

  try {
    const { userId, fileBase64, fileName, fileType } = JSON.parse(event.body);

    if (!userId || !fileBase64) {
      return { statusCode: 200, headers, body: JSON.stringify({ error: 'Faltan datos: userId o fileBase64' }) };
    }

    // Detectar extensión y content-type
    const ext = (fileName && fileName.split('.').pop()) || 'jpg';
    const safeExt = ['jpg', 'jpeg', 'png', 'webp'].includes(ext.toLowerCase()) ? ext.toLowerCase() : 'jpg';
    const contentType = fileType || (safeExt === 'png' ? 'image/png' : safeExt === 'webp' ? 'image/webp' : 'image/jpeg');

    // Path único con timestamp para evitar cache del CDN
    const timestamp = Date.now();
    const path = `${userId}/${timestamp}.${safeExt}`;

    // Limpiar base64 si viene con prefijo "data:image/...;base64,"
    const cleanBase64 = fileBase64.includes(',') ? fileBase64.split(',')[1] : fileBase64;
    const buffer = Buffer.from(cleanBase64, 'base64');

    // 1. Subir al bucket Avatars
    const uploadRes = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'apikey': SUPABASE_KEY,
        'Content-Type': contentType,
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
          bucket: BUCKET
        })
      };
    }

    const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;

    // 2. Actualizar avatar_url en profiles
    const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'apikey': SUPABASE_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({ avatar_url: publicUrl })
    });

    const patchText = await patchRes.text();

    if (!patchRes.ok) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          error: 'Error guardando URL en profiles: ' + patchText,
          url_uploaded: publicUrl
        })
      };
    }

    let updatedRows = [];
    try { updatedRows = JSON.parse(patchText); } catch (e) {}

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        url: publicUrl,
        avatar_url: publicUrl,
        updated_count: updatedRows.length,
        message: updatedRows.length === 0 ? 'Foto subida pero profiles NO actualizada (¿userId existe en profiles?)' : 'OK'
      })
    };
  } catch (err) {
    return { statusCode: 200, headers, body: JSON.stringify({ error: 'Exception: ' + err.message }) };
  }
};
