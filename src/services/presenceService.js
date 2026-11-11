import { onDisconnect, onValue, push, ref, remove, set, serverTimestamp } from 'firebase/database';
import { getFirebase } from './firebase';

export function formatLastSeen(lastSeen) {
  if (!lastSeen || !Number.isFinite(lastSeen)) {
    return 'Ngoại tuyến';
  }
  const diffMs = Date.now() - lastSeen;
  if (diffMs < 0) {
    return 'Vừa mới hoạt động';
  }
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) {
    return 'Vừa mới hoạt động';
  }
  if (diffMins < 60) {
    return `Hoạt động ${diffMins} phút trước`;
  }
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) {
    return `Hoạt động ${diffHours} giờ trước`;
  }
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) {
    return `Hoạt động ${diffDays} ngày trước`;
  }
  const date = new Date(lastSeen);
  return `Hoạt động ${date.toLocaleDateString('vi-VN')}`;
}

// One key per foreground session: logging out on one device leaves another device online.
export function startPresence(uid, onError) {
  const { db } = getFirebase();
  const session = push(ref(db, `status/${uid}/connections`));
  const disconnectSession = onDisconnect(session);
  const lastSeenRef = ref(db, `status/${uid}/lastSeen`);
  const disconnectLastSeen = onDisconnect(lastSeenRef);

  let stopped = false;
  const unsubscribe = onValue(ref(db, '.info/connected'), snapshot => {
    if (snapshot.val() !== true || stopped) { return; }
    (async () => {
      // Always register server cleanup before publishing online state.
      await disconnectSession.remove();
      await disconnectLastSeen.set(serverTimestamp());
      if (stopped) {
        await disconnectSession.cancel();
        await disconnectLastSeen.cancel();
        return;
      }
      await set(session, true);
      if (stopped) {
        await remove(session);
      }
    })().catch(error => { if (!stopped && onError) { onError(error); } });
  }, error => { if (!stopped && onError) { onError(error); } });

  return () => {
    stopped = true;
    unsubscribe();
    remove(session)
      .then(() => disconnectSession.cancel())
      .catch(() => {});
    set(lastSeenRef, serverTimestamp())
      .then(() => disconnectLastSeen.cancel())
      .catch(() => {});
  };
}
