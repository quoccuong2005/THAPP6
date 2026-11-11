import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, updateProfile, onAuthStateChanged } from 'firebase/auth';
import { get, ref, set, update, goOffline, goOnline } from 'firebase/database';
import { getFirebase } from './firebase';
let registrationName = '';

// Restores a missing database profile after an interrupted registration.
export async function ensureProfile(account, name) {
  const { db } = getFirebase();
  const profileRef = ref(db, `users/${account.uid}`);
  const snapshot = await get(profileRef);
  if (!snapshot.exists()) {
    await set(profileRef, {
      name: name || registrationName || account.displayName || account.email.split('@')[0],
      email: account.email,
    });
  }
}

export async function register(name, email, password, confirmation) {
  if (!name.trim()) { throw new Error('Vui lòng nhập họ tên.'); }
  if (name.trim().length > 100) { throw new Error('Họ tên tối đa 100 ký tự.'); }
  if (password.length < 6) { throw new Error('Mật khẩu phải có ít nhất 6 ký tự.'); }
  if (password !== confirmation) { throw new Error('Mật khẩu nhập lại không khớp.'); }
  const { auth } = getFirebase();
  registrationName = name.trim();
  try {
    const { user } = await createUserWithEmailAndPassword(auth, email.trim(), password);
    await updateProfile(user, { displayName: name.trim() });
    await ensureProfile(user, name.trim());
  } finally { registrationName = ''; }
}

export function login(email, password) {
  if (!email.trim() || !password) { throw new Error('Vui lòng nhập email và mật khẩu.'); }
  return signInWithEmailAndPassword(getFirebase().auth, email.trim(), password);
}

export async function logout() {
  const { db, auth } = getFirebase();
  // Closing the authenticated RTDB connection triggers this session's onDisconnect.
  goOffline(db);
  try { await signOut(auth); } catch (error) {
    goOnline(db);
    throw error;
  }
}

export async function updateUserProfile(uid, { name, avatar }) {
  const { auth, db } = getFirebase();
  const updates = {};
  if (name !== undefined) {
    if (!name.trim()) { throw new Error('Họ tên không được để trống.'); }
    updates.name = name.trim();
  }
  if (avatar !== undefined) {
    updates.avatar = avatar;
  }
  await update(ref(db, `users/${uid}`), updates);
  if (auth.currentUser) {
    const authProfileUpdates = {};
    if (name) { authProfileUpdates.displayName = name.trim(); }
    if (avatar) { authProfileUpdates.photoURL = avatar; }
    await updateProfile(auth.currentUser, authProfileUpdates).catch(() => {});
  }
}

export const observeAuth = callback => onAuthStateChanged(getFirebase().auth, callback);
