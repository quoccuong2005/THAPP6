// src/services/notificationService.js
import { ref, push, set, update, onValue, serverTimestamp, get } from 'firebase/database';
import { getFirebase } from './firebase';

export function observeNotifications(uid, callback, onError) {
  if (!uid) { return () => {}; }
  const notifRef = ref(getFirebase().db, `notifications/${uid}`);
  return onValue(notifRef, snapshot => {
    const data = snapshot.val() || {};
    const list = Object.entries(data)
      .map(([id, item]) => ({ ...item, id }))
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    callback(list);
  }, onError);
}

export async function createNotification(targetUid, { type, convId, fromUid, fromName, title, content }) {
  if (!targetUid || targetUid === fromUid) { return; }
  const notifRef = push(ref(getFirebase().db, `notifications/${targetUid}`));
  await set(notifRef, {
    type,
    convId,
    fromUid,
    fromName: fromName || 'Người dùng',
    title: title || 'Thông báo mới',
    content: content || '',
    createdAt: serverTimestamp(),
    read: false,
  });
  return notifRef.key;
}

export function markNotificationRead(uid, notifId) {
  if (!uid || !notifId) { return Promise.resolve(); }
  return update(ref(getFirebase().db, `notifications/${uid}/${notifId}`), {
    read: true,
  });
}

export async function markAllNotificationsRead(uid) {
  if (!uid) { return; }
  const notifRef = ref(getFirebase().db, `notifications/${uid}`);
  const snapshot = await get(notifRef);
  if (!snapshot.exists()) { return; }

  const updates = {};
  snapshot.forEach(child => {
    if (!child.val().read) {
      updates[`notifications/${uid}/${child.key}/read`] = true;
    }
  });

  if (Object.keys(updates).length > 0) {
    await update(ref(getFirebase().db), updates);
  }
}
