// Pure helpers shared by UI/services and tested without Firebase or a device.
export function conversationId(first, second) {
  if (!first || !second || first === second) {
    throw new Error('Cuộc trò chuyện cần hai người dùng khác nhau.');
  }
  return [first, second].sort().join('__');
}

export function formatTime(timestamp) {
  if (!Number.isFinite(timestamp)) { return 'Đang gửi…'; }
  return new Date(timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

export function orderedMessages(messages = {}) {
  return Object.entries(messages).map(([id, message]) => ({ ...message, id }))
    .sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

export function unreadCount(messages, uid, readKey = '') {
  return orderedMessages(messages).filter(message => message.senderId !== uid && message.id > readKey).length;
}

export function messagePayload(senderId, recipientId, content, createdAt) {
  const payload = {
    senderId,
    createdAt,
    recalled: false,
  };
  if (recipientId) {
    payload.recipientId = recipientId;
  }
  if (content.senderName) {
    payload.senderName = content.senderName;
  }
  if (content.replyTo) {
    payload.replyTo = content.replyTo;
  }

  if (content.type === 'location') {
    const { latitude, longitude } = content;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) ||
        Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
      throw new Error('Tọa độ vị trí không hợp lệ.');
    }
    payload.type = 'location';
    payload.latitude = latitude;
    payload.longitude = longitude;
    return payload;
  }

  if (content.type === 'image') {
    const imageUrl = content.imageUrl?.trim();
    if (!imageUrl) {
      throw new Error('Đường dẫn ảnh không hợp lệ.');
    }
    payload.type = 'image';
    payload.imageUrl = imageUrl;
    return payload;
  }

  if (content.type === 'system') {
    payload.type = 'system';
    payload.text = content.text || '';
    return payload;
  }

  const text = content.text?.trim();
  if (!text) { throw new Error('Không thể gửi tin nhắn rỗng.'); }
  if (text.length > 4000) { throw new Error('Tin nhắn tối đa 4000 ký tự.'); }
  payload.type = 'text';
  payload.text = text;
  return payload;
}

export function userProfile(uid, value = {}, presence = {}) {
  return {
    id: uid,
    name: value.name || 'Người dùng',
    email: value.email || '',
    phone: '',
    avatar: value.avatar || 'https://ui-avatars.com/api/?background=4F46E5&color=fff&name=' + encodeURIComponent(value.name || 'User'),
    isOnline: Object.keys(presence.connections || {}).length > 0,
    lastSeen: presence.lastSeen || null,
  };
}

export function conversationSummary(id, data, uid, profiles, statuses, userChatData = null) {
  const isGroup = data.type === 'group';
  let targetUser;

  if (isGroup) {
    const memberUids = Object.keys(data.members || {});
    const onlineCount = memberUids.filter(mId => Object.keys(statuses[mId]?.connections || {}).length > 0).length;
    targetUser = {
      id,
      isGroup: true,
      name: data.name || 'Nhóm',
      avatar: data.avatar || 'https://ui-avatars.com/api/?background=4F46E5&color=fff&name=' + encodeURIComponent(data.name || 'Group'),
      isOnline: onlineCount > 0,
      onlineCount,
      totalMembers: memberUids.length,
      members: data.members || {},
    };
  } else {
    let peerId;
    if (data.memberA && data.memberB) {
      peerId = data.memberA === uid ? data.memberB : data.memberA;
    } else if (data.members) {
      peerId = Object.keys(data.members).find(m => m !== uid) || uid;
    } else {
      peerId = id.split('__').find(m => m !== uid) || uid;
    }
    targetUser = userProfile(peerId, profiles[peerId], statuses[peerId]);
  }

  const messages = orderedMessages(data.messages);
  const last = messages[messages.length - 1];

  let lastMessageText = userChatData?.lastMessage;
  if (!lastMessageText) {
    if (last) {
      if (last.recalled) {
        lastMessageText = 'Tin nhắn đã được thu hồi';
      } else if (last.type === 'image') {
        lastMessageText = '📷 Hình ảnh';
      } else if (last.type === 'location') {
        lastMessageText = '📍 Vị trí';
      } else {
        lastMessageText = last.text;
      }
    } else if (data.lastMessage) {
      lastMessageText = data.lastMessage;
    }
  }

  if (!lastMessageText && !last) {
    return null;
  }

  const updatedAt = userChatData?.updatedAt || data.updatedAt || last?.createdAt || 0;
  const unread = userChatData?.unread !== undefined
    ? Number(userChatData.unread)
    : unreadCount(data.messages, uid, data.reads?.[uid]);

  return {
    id,
    type: isGroup ? 'group' : 'direct',
    name: targetUser.name,
    user: targetUser,
    lastMessage: lastMessageText || '',
    time: formatTime(updatedAt),
    updatedAt: updatedAt || 0,
    lastKey: last?.id || '',
    unreadCount: Math.max(0, unread),
  };
}
