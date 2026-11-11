// src/services/chatService.js
import {
  get,
  goOnline,
  increment,
  limitToLast,
  onDisconnect,
  onValue,
  orderByKey,
  push,
  query,
  ref,
  remove,
  serverTimestamp,
  set,
  update,
} from 'firebase/database';
import { getFirebase } from './firebase';
import { conversationId, messagePayload } from './chatModel';
import { createNotification } from './notificationService';

export function resumeDatabase() {
  goOnline(getFirebase().db);
}

export function observeUsers(callback, onError) {
  return onValue(ref(getFirebase().db, 'users'), snapshot => callback(snapshot.val() || {}), onError);
}

export function observePresence(callback, onError) {
  return onValue(ref(getFirebase().db, 'status'), snapshot => callback(snapshot.val() || {}), onError);
}

export function observeChat(id, callback, onError) {
  return onValue(ref(getFirebase().db, `conversations/${id}`), snapshot => callback(snapshot.val()), onError);
}

export function observeChatIndex(uid, callback, onError) {
  return onValue(ref(getFirebase().db, `userChats/${uid}`), snapshot => callback(snapshot.val() || {}), onError);
}

export function observeTyping(convId, callback, onError) {
  if (!convId) { return () => {}; }
  return onValue(ref(getFirebase().db, `typing/${convId}`), snapshot => callback(snapshot.val() || {}), onError);
}

export function observeReadStatus(convId, callback, onError) {
  if (!convId) { return () => {}; }
  return onValue(ref(getFirebase().db, `readStatus/${convId}`), snapshot => callback(snapshot.val() || {}), onError);
}

export function observeMessagesPaged(convId, limitCount, callback, onError) {
  if (!convId) { return () => {}; }
  const { db } = getFirebase();
  const q = query(ref(db, `messages/${convId}`), orderByKey(), limitToLast(limitCount));
  return onValue(q, snapshot => {
    const val = snapshot.val();
    if (val) {
      callback(val);
    } else {
      // Fallback check conversations/${convId}/messages
      const fallbackRef = query(ref(db, `conversations/${convId}/messages`), orderByKey(), limitToLast(limitCount));
      get(fallbackRef)
        .then(snap => callback(snap.val() || {}))
        .catch(() => callback({}));
    }
  }, onError);
}

export async function ensureConversation(uid, peerId) {
  const { db } = getFirebase();
  const id = conversationId(uid, peerId);
  const conversationRef = ref(db, `conversations/${id}`);
  const existing = await get(conversationRef);

  if (!existing.exists()) {
    const [memberA, memberB] = [uid, peerId].sort();
    const now = serverTimestamp();
    await set(conversationRef, {
      type: 'direct',
      memberA,
      memberB,
      members: { [uid]: true, [peerId]: true },
      createdAt: now,
      updatedAt: now,
    });
    const updates = {
      [`userChats/${uid}/${id}`]: {
        lastMessage: '',
        lastSenderId: '',
        updatedAt: now,
        unread: 0,
      },
      [`userChats/${peerId}/${id}`]: {
        lastMessage: '',
        lastSenderId: '',
        updatedAt: now,
        unread: 0,
      },
    };
    await update(ref(db), updates);
  } else {
    // Repair index if missing
    await update(ref(db), {
      [`userChats/${uid}/${id}`]: true,
      [`userChats/${peerId}/${id}`]: true,
    });
  }
  return id;
}

export async function sendMessage(senderId, recipientOrConvId, content, senderName = '') {
  const { db } = getFirebase();
  let convId = recipientOrConvId;

  // If this is direct chat identified by peerId
  if (!convId.includes('__') && !convId.startsWith('-') && !convId.startsWith('group_')) {
    convId = await ensureConversation(senderId, recipientOrConvId);
  } else {
    const existing = await get(ref(db, `conversations/${convId}`));
    if (!existing.exists() && convId.includes('__')) {
      const [u1, u2] = convId.split('__');
      await ensureConversation(u1, u2);
    }
  }

  const convSnap = await get(ref(db, `conversations/${convId}`));
  const convData = convSnap.val() || {};
  const memberIds = convData.members
    ? Object.keys(convData.members)
    : [convData.memberA, convData.memberB].filter(Boolean);

  const now = serverTimestamp();
  const payload = messagePayload(senderId, convId, { ...content, senderName }, now);

  const msgRef = push(ref(db, `messages/${convId}`));
  const msgKey = msgRef.key;

  let summaryText = '';
  if (content.type === 'location') {
    summaryText = '📍 Vị trí';
  } else if (content.type === 'image') {
    summaryText = '📷 Hình ảnh';
  } else {
    summaryText = content.text?.trim() || '';
  }

  const updates = {};
  // 1. Message node
  updates[`messages/${convId}/${msgKey}`] = payload;
  updates[`conversations/${convId}/messages/${msgKey}`] = payload;

  // 2. Conversation summary
  updates[`conversations/${convId}/lastMessage`] = summaryText;
  updates[`conversations/${convId}/lastSenderId`] = senderId;
  updates[`conversations/${convId}/updatedAt`] = now;

  // 3. Multi-path update for userChats with increment(1)
  memberIds.forEach(mId => {
    updates[`userChats/${mId}/${convId}/lastMessage`] = summaryText;
    updates[`userChats/${mId}/${convId}/lastSenderId`] = senderId;
    updates[`userChats/${mId}/${convId}/updatedAt`] = now;
    if (mId !== senderId) {
      updates[`userChats/${mId}/${convId}/unread`] = increment(1);
    }
  });

  await update(ref(db), updates);

  // Send notifications to other members
  memberIds.forEach(mId => {
    if (mId !== senderId) {
      const isGroup = convData.type === 'group';
      const notifTitle = isGroup ? (convData.name || 'Nhóm') : (senderName || 'Tin nhắn mới');
      const notifBody = isGroup ? `${senderName || 'Thành viên'}: ${summaryText}` : summaryText;

      createNotification(mId, {
        type: 'message',
        convId,
        fromUid: senderId,
        fromName: senderName || 'Người dùng',
        title: notifTitle,
        content: notifBody,
      }).catch(() => {});
    }
  });

  return msgKey;
}

export async function recallMessage(convId, messageId, uid) {
  const { db } = getFirebase();
  const convSnap = await get(ref(db, `conversations/${convId}`));
  const convData = convSnap.val() || {};
  const memberIds = convData.members
    ? Object.keys(convData.members)
    : [convData.memberA, convData.memberB].filter(Boolean);

  const recalledText = 'Tin nhắn đã được thu hồi';
  const updates = {
    [`messages/${convId}/${messageId}/recalled`]: true,
    [`conversations/${convId}/messages/${messageId}/recalled`]: true,
    [`conversations/${convId}/lastMessage`]: recalledText,
  };

  memberIds.forEach(mId => {
    updates[`userChats/${mId}/${convId}/lastMessage`] = recalledText;
  });

  await update(ref(db), updates);
}

export async function toggleReaction(convId, messageId, uid, userName, emoji, messageOwnerId) {
  const { db } = getFirebase();
  const reactionRef = ref(db, `messages/${convId}/${messageId}/reactions/${uid}`);
  const snap = await get(reactionRef);
  const currentEmoji = snap.val();

  if (currentEmoji === emoji) {
    // Remove reaction
    await remove(reactionRef);
    await remove(ref(db, `conversations/${convId}/messages/${messageId}/reactions/${uid}`)).catch(() => {});
  } else {
    // Set reaction
    await set(reactionRef, emoji);
    await set(ref(db, `conversations/${convId}/messages/${messageId}/reactions/${uid}`), emoji).catch(() => {});

    if (messageOwnerId && messageOwnerId !== uid) {
      createNotification(messageOwnerId, {
        type: 'reaction',
        convId,
        fromUid: uid,
        fromName: userName || 'Người dùng',
        title: 'Cảm xúc mới',
        content: `${userName || 'Người dùng'} đã thả ${emoji} vào tin nhắn của bạn`,
      }).catch(() => {});
    }
  }
}

export function setTyping(convId, uid, isTyping) {
  if (!convId || !uid) { return Promise.resolve(); }
  const { db } = getFirebase();
  const typingRef = ref(db, `typing/${convId}/${uid}`);
  if (isTyping) {
    onDisconnect(typingRef).remove();
    return set(typingRef, true);
  } else {
    onDisconnect(typingRef).cancel();
    return remove(typingRef);
  }
}

export async function markConversationAsRead(convId, uid, messageKey) {
  if (!convId || !uid) { return; }
  const { db } = getFirebase();
  const now = Date.now();
  const updates = {
    [`readStatus/${convId}/${uid}`]: {
      lastReadTime: now,
      lastMessageId: messageKey || '',
    },
    [`userChats/${uid}/${convId}/unread`]: 0,
    [`conversations/${convId}/reads/${uid}`]: messageKey || now,
  };
  await update(ref(db), updates).catch(() => {});
}

// For compatibility with TH5 tests
export function markRead(id, uid, messageKey) {
  return markConversationAsRead(id, uid, messageKey);
}
