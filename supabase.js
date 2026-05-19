// ============================================
// supabase.js — He Knows · She Knows
// Importa este archivo en TODAS las páginas
// ANTES de cualquier otro script tuyo
// ============================================

const SUPABASE_URL = 'https://ydqcxbwxfzyxdzidalch.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkcWN4Ynd4Znp5eGR6aWRhZmNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxOTczMjMsImV4cCI6MjA5NDc3MzMyM30.a8t8km5BIYODC6Sp_rWE8XCJ1yfHwfdcLjrpN5nBms0';

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── PERFIL ──────────────────────────────────

async function getProfile(userId) {
  const { data } = await db.from('profiles').select('*').eq('id', userId).single();
  return data;
}

async function upsertProfile(userId, email, extra = {}) {
  const { error } = await db.from('profiles').upsert(
    { id: userId, email, ...extra },
    { onConflict: 'id' }
  );
  return !error;
}

async function saveProfile(userId, fields) {
  const { error } = await db.from('profiles').update(fields).eq('id', userId);
  return !error;
}

// ── ADVISOR PROFILE ──────────────────────────

async function getAdvisorProfile(userId) {
  const { data } = await db.from('advisor_profiles').select('*').eq('id', userId).single();
  return data;
}

async function saveAdvisorProfile(userId, fields) {
  const { error } = await db.from('advisor_profiles')
    .upsert({ id: userId, ...fields, updated_at: new Date().toISOString() }, { onConflict: 'id' });
  return !error;
}

// ── ADVISORS (búsqueda) ──────────────────────

async function getAdvisors(specialty = null) {
  const { data } = await db.from('profiles')
    .select('id, full_name, avatar_url, bio, advisor_profiles(specialty, price_per_session, available, years_experience)')
    .eq('role', 'advisor');
  if (!data) return [];
  if (specialty) return data.filter(a => a.advisor_profiles?.specialty === specialty);
  return data;
}

// ── AVATAR ───────────────────────────────────

async function uploadAvatar(userId, file) {
  const ext = file.name.split('.').pop();
  const path = `avatars/${userId}.${ext}`;
  const { error } = await db.storage.from('avatars').upload(path, file, { upsert: true });
  if (error) return null;
  const { data } = db.storage.from('avatars').getPublicUrl(path);
  return data.publicUrl;
}

// ── AUTH helpers ─────────────────────────────

function requireAuth(redirectTo = '/') {
  if (typeof netlifyIdentity === 'undefined') return;
  netlifyIdentity.on('init', user => {
    if (!user) window.location.href = redirectTo;
  });
}

function currentUser() {
  if (typeof netlifyIdentity === 'undefined') return null;
  return netlifyIdentity.currentUser();
}

function initAuthSync() {
  if (typeof netlifyIdentity === 'undefined') return;
  netlifyIdentity.on('login', async user => {
    await upsertProfile(user.id, user.email, {
      full_name: user.user_metadata?.full_name || '',
      role: 'user'
    });
    netlifyIdentity.close();
  });
}

window.HKSK = {
  db,
  getProfile, upsertProfile, saveProfile,
  getAdvisorProfile, saveAdvisorProfile,
  getAdvisors,
  uploadAvatar,
  requireAuth, currentUser, initAuthSync
};
