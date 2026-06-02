// supabase.js — He Knows · She Knows
const SUPABASE_URL = 'https://ydqcxbwxfzyxdzidafch.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_6LRVFCwHqtf0r9daHpqbLg_oH9VTpRA';
const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    storageKey: 'hksk-auth',
    storage: window.localStorage,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});

// Al cargar, sincronizar sesión de hksk-session → SDK
(async () => {
  try {
    const saved = JSON.parse(localStorage.getItem('hksk-session'));
    if (saved?.access_token) {
      await db.auth.setSession({
        access_token: saved.access_token,
        refresh_token: saved.refresh_token
      });
    }
  } catch(e) {}
})();

async function signUp(email, password) {
  // 👇 ARREGLO: le decimos a Supabase a dónde mandar a la persona después de
  //    confirmar su correo. Sin esto, usaba el "Site URL" (dashboard.html),
  //    que no sabe procesar la confirmación, y la gente quedaba atorada.
  const { data, error } = await db.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: 'https://he-sheknows.com/confirm-email.html'
    }
  });
  return { data, error };
}
async function signIn(email, password) {
  const { data, error } = await db.auth.signInWithPassword({ email, password });
  return { data, error };
}
async function signOut() {
  // 1. Cerrar sesión en el SDK (scope global borra el refresh token del server)
  try { await db.auth.signOut({ scope: 'global' }); } catch(e) {}
  // 2. Borrar la sesión custom y TODAS las claves del SDK de Supabase
  try {
    localStorage.removeItem('hksk-session');
    Object.keys(localStorage).forEach(function(k){
      if (k.indexOf('sb-') === 0 || k.indexOf('supabase') !== -1) {
        localStorage.removeItem(k);
      }
    });
    sessionStorage.clear();
    // Marca para que login.html NO resucite la sesión justo después de salir
    sessionStorage.setItem('hksk-just-logged-out', '1');
  } catch(e) {}
  // 3. Pequeña espera para que el SDK termine de limpiar, luego ir a login
  setTimeout(function(){ window.location.replace('login.html'); }, 150);
}
async function getSession() {
  const { data } = await db.auth.getSession();
  return data.session;
}
async function getUser() {
  const { data } = await db.auth.getUser();
  return data.user;
}
async function requireAuth() {
  const session = await getSession();
  if (!session) window.location.href = '/login.html';
  return session;
}
async function getProfile(userId) {
  // Leemos el perfil vía función con llave secreta (la tabla profiles tiene RLS,
  // así que leer directo con la llave pública ya no funciona).
  try {
    const saved = JSON.parse(localStorage.getItem('hksk-session'));
    const token = saved?.access_token;
    if (!token) return null;
    const res = await fetch('/.netlify/functions/get-public-profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })  // sin profileId = mi propio perfil completo
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.profile || null;
  } catch (e) {
    console.error('getProfile error:', e);
    return null;
  }
}
async function saveProfile(userId, email, fields) {
  const { error } = await db.from('profiles')
    .upsert({ id: userId, email, ...fields }, { onConflict: 'id' });
  if (error) console.error('saveProfile error:', error);
  return !error;
}
async function getAdvisorProfile(userId) {
  const { data } = await db.from('advisor_profiles').select('*').eq('id', userId).single();
  return data;
}
async function saveAdvisorProfile(userId, fields) {
  const { error } = await db.from('advisor_profiles')
    .upsert({ id: userId, ...fields, updated_at: new Date().toISOString() }, { onConflict: 'id' });
  if (error) console.error('saveAdvisorProfile error:', error);
  return !error;
}
async function getAdvisors(specialty = null) {
  const { data } = await db.from('profiles')
    .select('id, full_name, avatar_url, bio, advisor_profiles(specialty, price_per_session, available, years_experience)')
    .eq('role', 'advisor');
  if (!data) return [];
  if (specialty) return data.filter(a => a.advisor_profiles?.specialty === specialty);
  return data;
}
async function uploadAvatar(userId, file) {
  const ext = file.name.split('.').pop();
  const path = `${userId}.${ext}`;
  const { error } = await db.storage.from('avatars').upload(path, file, { upsert: true });
  if (error) { console.error('uploadAvatar error:', error); return null; }
  const { data } = db.storage.from('avatars').getPublicUrl(path);
  return data.publicUrl;
}
window.HKSK = {
  db,
  signUp, signIn, signOut,
  getSession, getUser, requireAuth,
  getProfile, saveProfile,
  getAdvisorProfile, saveAdvisorProfile,
  getAdvisors, uploadAvatar
};
