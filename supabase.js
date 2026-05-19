// supabase.js — He Knows · She Knows

const SUPABASE_URL = 'https://ydqcxbwxfzyxdzidalch.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkcWN4Ynd4Znp5eGR6aWRhZmNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxOTczMjMsImV4cCI6MjA5NDc3MzMyM30.a8t8km5BIYODC6Sp_rWE8XCJ1yfHwfdcLjrpN5nBms0';

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Obtener perfil por email
async function getProfile(email) {
  const { data } = await db.from('profiles').select('*').eq('email', email).single();
  return data;
}

// Guardar/crear perfil por email
async function saveProfile(email, fields) {
  const { error } = await db.from('profiles')
    .upsert({ email, ...fields }, { onConflict: 'email' });
  if (error) console.error('saveProfile error:', error);
  return !error;
}

// Obtener advisor profile
async function getAdvisorProfile(email) {
  const { data } = await db.from('advisor_profiles').select('*').eq('email', email).single();
  return data;
}

// Guardar advisor profile
async function saveAdvisorProfile(email, fields) {
  const { error } = await db.from('advisor_profiles')
    .upsert({ email, ...fields, updated_at: new Date().toISOString() }, { onConflict: 'email' });
  if (error) console.error('saveAdvisorProfile error:', error);
  return !error;
}

// Buscar advisors
async function getAdvisors(specialty = null) {
  const { data } = await db.from('profiles')
    .select('email, full_name, avatar_url, bio, advisor_profiles(specialty, price_per_session, available, years_experience)')
    .eq('role', 'advisor');
  if (!data) return [];
  if (specialty) return data.filter(a => a.advisor_profiles?.specialty === specialty);
  return data;
}

// Upload avatar
async function uploadAvatar(email, file) {
  const ext = file.name.split('.').pop();
  const path = `avatars/${email.replace('@','_')}.${ext}`;
  const { error } = await db.storage.from('avatars').upload(path, file, { upsert: true });
  if (error) return null;
  const { data } = db.storage.from('avatars').getPublicUrl(path);
  return data.publicUrl;
}

// Auth
function currentUser() {
  if (typeof netlifyIdentity === 'undefined') return null;
  return netlifyIdentity.currentUser();
}

window.HKSK = {
  db,
  getProfile, saveProfile,
  getAdvisorProfile, saveAdvisorProfile,
  getAdvisors, uploadAvatar,
  currentUser
};
