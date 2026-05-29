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
  await db.auth.signOut();
  localStorage.removeItem('hksk-session');
  window.location.href = '/';
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
  const { data } = await db.from('profiles').select('*').eq('id', userId).single();
  return data;
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
