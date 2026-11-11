// src/services/groupService.js
import { ref, push, set, update, remove, serverTimestamp } from 'firebase/database';
import { getFirebase } from './firebase';
import { createNotification } from './notificationService';

export async function createGroup(groupName, creatorUid, creatorName, memberUids) {
  const name = groupName?.trim();
  if (!name) {
    throw new Error('Vui lòng nhập tên nhóm.');
  }
  if (!memberUids || memberUids.length < 2) {
    throw new Error('Nhóm cần tối thiểu 2 thành viên khác ngoài bạn.');
  }

  const { db } = getFirebase();
  const groupRef = push(ref(db, 'conversations'));
  const groupId = groupRef.key;

  const allMembers = Array.from(new Set([creatorUid, ...memberUids]));
  const membersMap = {};
  allMembers.forEach(uid => {
    membersMap[uid] = true;
  });

  const now = serverTimestamp();
  const initialText = `${creatorName || 'Người dùng'} đã tạo nhóm "${name}"`;

  // System message push key
  const msgRef = push(ref(db, `messages/${groupId}`));
  const msgKey = msgRef.key;

  // 1. Persist conversation node first so it exists in RTDB root for member rules
  await set(ref(db, `conversations/${groupId}`), {
    type: 'group',
    name,
    createdBy: creatorUid,
    createdAt: now,
    updatedAt: now,
    lastMessage: initialText,
    members: membersMap,
  });

  // 2. Initial system message and userChats
  const updates = {};
  updates[`messages/${groupId}/${msgKey}`] = {
    senderId: creatorUid,
    senderName: creatorName || 'Hệ thống',
    type: 'system',
    text: initialText,
    createdAt: now,
    recalled: false,
  };

  allMembers.forEach(uid => {
    updates[`userChats/${uid}/${groupId}`] = {
      lastMessage: initialText,
      lastSenderId: creatorUid,
      updatedAt: now,
      unread: 0,
    };
  });

  await update(ref(db), updates);

  // Send notifications to added members
  memberUids.forEach(uid => {
    createNotification(uid, {
      type: 'group',
      convId: groupId,
      fromUid: creatorUid,
      fromName: creatorName || 'Người dùng',
      title: 'Được thêm vào nhóm',
      content: `${creatorName || 'Một người dùng'} đã thêm bạn vào nhóm "${name}"`,
    }).catch(() => {});
  });

  return groupId;
}

export async function updateGroupName(groupId, newName, actorUid, actorName) {
  const name = newName?.trim();
  if (!name) { throw new Error('Tên nhóm không được để trống.'); }

  const { db } = getFirebase();
  const now = serverTimestamp();
  const msgRef = push(ref(db, `messages/${groupId}`));
  const text = `${actorName || 'Thành viên'} đã đổi tên nhóm thành "${name}"`;

  const updates = {
    [`conversations/${groupId}/name`]: name,
    [`conversations/${groupId}/lastMessage`]: text,
    [`conversations/${groupId}/updatedAt`]: now,
    [`messages/${groupId}/${msgRef.key}`]: {
      senderId: actorUid,
      senderName: actorName || 'Hệ thống',
      type: 'system',
      text,
      createdAt: now,
      recalled: false,
    },
  };

  await update(ref(db), updates);
}

export async function addGroupMembers(groupId, groupName, newMemberUids, actorUid, actorName, currentMembers = {}) {
  if (!newMemberUids || newMemberUids.length === 0) { return; }
  const { db } = getFirebase();
  const now = serverTimestamp();
  const msgRef = push(ref(db, `messages/${groupId}`));
  const text = `${actorName || 'Thành viên'} đã thêm thành viên mới vào nhóm`;

  const updates = {
    [`conversations/${groupId}/lastMessage`]: text,
    [`conversations/${groupId}/updatedAt`]: now,
    [`messages/${groupId}/${msgRef.key}`]: {
      senderId: actorUid,
      senderName: actorName || 'Hệ thống',
      type: 'system',
      text,
      createdAt: now,
      recalled: false,
    },
  };

  newMemberUids.forEach(uid => {
    updates[`conversations/${groupId}/members/${uid}`] = true;
    updates[`userChats/${uid}/${groupId}`] = {
      lastMessage: text,
      lastSenderId: actorUid,
      updatedAt: now,
      unread: 0,
    };
  });

  await update(ref(db), updates);

  newMemberUids.forEach(uid => {
    createNotification(uid, {
      type: 'group',
      convId: groupId,
      fromUid: actorUid,
      fromName: actorName || 'Người dùng',
      title: 'Được thêm vào nhóm',
      content: `${actorName || 'Thành viên'} đã thêm bạn vào nhóm "${groupName}"`,
    }).catch(() => {});
  });
}

export async function removeGroupMember(groupId, memberUid, memberName, actorUid, actorName) {
  const { db } = getFirebase();
  const now = serverTimestamp();
  const msgRef = push(ref(db, `messages/${groupId}`));
  const text = `${actorName || 'Trưởng nhóm'} đã xóa ${memberName || 'một thành viên'} khỏi nhóm`;

  const updates = {
    [`conversations/${groupId}/lastMessage`]: text,
    [`conversations/${groupId}/updatedAt`]: now,
    [`conversations/${groupId}/members/${memberUid}`]: null,
    [`messages/${groupId}/${msgRef.key}`]: {
      senderId: actorUid,
      senderName: actorName || 'Hệ thống',
      type: 'system',
      text,
      createdAt: now,
      recalled: false,
    },
  };

  await update(ref(db), updates);
  await remove(ref(db, `userChats/${memberUid}/${groupId}`)).catch(() => {});
}

export async function leaveGroup(groupId, uid, userName) {
  const { db } = getFirebase();
  const now = serverTimestamp();
  const msgRef = push(ref(db, `messages/${groupId}`));
  const text = `${userName || 'Một thành viên'} đã rời nhóm`;

  const updates = {
    [`conversations/${groupId}/lastMessage`]: text,
    [`conversations/${groupId}/updatedAt`]: now,
    [`conversations/${groupId}/members/${uid}`]: null,
    [`messages/${groupId}/${msgRef.key}`]: {
      senderId: uid,
      senderName: userName || 'Hệ thống',
      type: 'system',
      text,
      createdAt: now,
      recalled: false,
    },
  };

  await update(ref(db), updates);
  await remove(ref(db, `userChats/${uid}/${groupId}`)).catch(() => {});
}
