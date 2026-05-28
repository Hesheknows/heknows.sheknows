// netlify/functions/update-profile.js
// v2: valida nombre con reglas de marketplace.
// Si el usuario YA es advisor, también exige nombre real (no apodos).
// Nota: la foto se sube por separado en avatar-upload.js, aquí no se toca.
// Pero si tu frontend permite borrar el avatar_url enviando null/vacío, esta función
// también lo bloquea para advisors.

const { validarNombre } = require('./name-validator');

const json = (statusCode, data) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  },
  body: JSON.stringify(data)
});

exports.handler = async (event) => {
  // CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return json(200, { ok: true });
  }

  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method Not Allowed' });
  }

  // 1. Parsear body
  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (e) {
    console.error('JSON inválido en body:', e.message);
    return json(400, { error: 'JSON inválido en el body' });
  }

  const { token, full_name, bio, city, country, gender, is_anonymous, avatar_url } = body;

  if (!token) {
    return json(400, { error: 'Token requerido' });
  }

  // 2. Variables de entorno
  const URL = 'https://ydqcxbwxfzyxdzidafch.supabase.co';
  const SERVICE_KEY = process.env.SUPABASE_SECRET_KEY;
  const ANON_KEY = 'sb_publishable_6LRVFCwHqtf0r9daHpqbLg_oH9VTpRA';

  if (!SERVICE_KEY) {
    console.error('SUPABASE_SECRET_KEY no está configurada en Netlify');
    return json(500, { error: 'Error de configuración del servidor' });
  }

  // 3. Verificar usuario con el token
  let userData;
  try {
    const userRes = await fetch(`${URL}/auth/v1/user`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'apikey': ANON_KEY
      }
    });

    if (!userRes.ok) {
      const errText = await userRes.text();
      console.error('Auth falló:', userRes.status, errText);
      return json(401, { error: 'Token inválido o expirado' });
    }

    userData = await userRes.json();
  } catch (e) {
    console.error('Error al verificar usuario:', e.message);
    return json(500, { error: 'Error al verificar usuario' });
  }

  if (!userData || !userData.id) {
    return json(401, { error: 'Usuario no encontrado' });
  }

  // 🆕 4. Si se quiere cambiar el nombre, validarlo
  let nombreLimpio = null;
  if (typeof full_name === 'string') {
    const v = validarNombre(full_name);
    if (!v.valido) {
      return json(400, { error: v.error, field: 'full_name' });
    }
    nombreLimpio = v.nombreLimpio;
  }

  // 🆕 5. Si el usuario YA es advisor, no permitir borrar la foto
  //       (revisar si están mandando avatar_url vacío o null intencionalmente)
  let esAdvisor = false;
  try {
    const profRes = await fetch(
      `${URL}/rest/v1/profiles?id=eq.${userData.id}&select=role,avatar_url`,
      { headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` } }
    );
    const [perfilActual] = await profRes.json();
    esAdvisor = (perfilActual?.role === 'advisor');
  } catch (e) {
    console.warn('No se pudo verificar rol (no crítico):', e.message);
  }

  if (esAdvisor && 'avatar_url' in body) {
    // Solo evaluamos si el frontend mandó avatar_url explícitamente
    if (!avatar_url || (typeof avatar_url === 'string' && !avatar_url.trim())) {
      return json(400, {
        error: 'Como advisor, no puedes eliminar tu foto de perfil. Súbe una nueva foto si quieres reemplazarla.',
        field: 'avatar_url'
      });
    }
  }

  // 6. Construir payload solo con campos enviados (evita sobreescribir con undefined)
  const payload = {};
  if (nombreLimpio !== null) payload.full_name = nombreLimpio;
  if (typeof bio === 'string') payload.bio = bio.trim();
  if (typeof city === 'string') payload.city = city.trim();
  if (typeof country === 'string') payload.country = country.trim();
  if (typeof gender === 'string') payload.gender = gender.trim();
  if (typeof is_anonymous === 'boolean') payload.is_anonymous = is_anonymous;

  if (Object.keys(payload).length === 0) {
    return json(400, { error: 'No hay datos para actualizar' });
  }

  // 7. Actualizar profile en Supabase
  try {
    const updateRes = await fetch(`${URL}/rest/v1/profiles?id=eq.${userData.id}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'apikey': SERVICE_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(payload)
    });

    // Leer respuesta como texto primero (para no fallar si Supabase manda algo raro)
    const responseText = await updateRes.text();

    if (!updateRes.ok) {
      console.error('Error de Supabase:', updateRes.status, responseText);
      // Intentar parsear como JSON, si falla mandar error genérico
      let supaError = 'Error al actualizar el perfil';
      try {
        const parsed = JSON.parse(responseText);
        supaError = parsed.message || parsed.error || supaError;
      } catch {}
      return json(updateRes.status, { error: supaError });
    }

    // Parsear respuesta exitosa
    let updatedProfile = null;
    try {
      updatedProfile = JSON.parse(responseText);
    } catch {
      // No es JSON pero el status es ok — está bien
    }

    return json(200, {
      ok: true,
      profile: Array.isArray(updatedProfile) ? updatedProfile[0] : updatedProfile
    });

  } catch (e) {
    console.error('Error al actualizar profile:', e.message);
    return json(500, { error: 'Error de red al actualizar perfil' });
  }
};
