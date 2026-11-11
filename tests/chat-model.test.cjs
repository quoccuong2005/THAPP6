const { test } = require('node:test');
const assert = require('node:assert/strict');
const load = require('./load-service.cjs');
const model = load('chatModel');
const presence = load('presenceService', { './firebase': { getFirebase: () => ({ db: {} }) } });

test('same conversation from either side, self-chat rejected', () => {
  assert.equal(model.conversationId('bob', 'alice'), 'alice__bob');
  assert.equal(model.conversationId('alice', 'bob'), 'alice__bob');
  assert.throws(() => model.conversationId('alice', 'alice'));
});

test('reject empty/too long text and invalid coordinates; retain valid content', () => {
  assert.throws(() => model.messagePayload('a', 'b', { text: ' \n\t' }, 1));
  assert.throws(() => model.messagePayload('a', 'b', { text: 'a'.repeat(4001) }, 1));
  assert.throws(() => model.messagePayload('a', 'b', { type: 'location', latitude: NaN, longitude: 106 }, 1));
  assert.throws(() => model.messagePayload('a', 'b', { type: 'location', latitude: 91, longitude: 106 }, 1));
  assert.equal(model.messagePayload('a', 'b', { text: ' Chào bạn ' }, 1).text, 'Chào bạn');
  assert.equal(model.messagePayload('a', 'b', { type: 'location', latitude: 10.8, longitude: 106.7 }, 1).longitude, 106.7);
});

test('image message payload validation', () => {
  assert.throws(() => model.messagePayload('a', 'b', { type: 'image', imageUrl: '  ' }, 1));
  const payload = model.messagePayload('a', 'b', { type: 'image', imageUrl: 'https://res.cloudinary.com/demo/image/upload/sample.jpg' }, 1);
  assert.equal(payload.type, 'image');
  assert.equal(payload.imageUrl, 'https://res.cloudinary.com/demo/image/upload/sample.jpg');
  assert.equal(payload.recalled, false);
});

test('read marker counts incoming messages only, including equal timestamps', () => {
  const messages = { m1: { senderId: 'b', createdAt: 1 }, m2: { senderId: 'a', createdAt: 1 }, m3: { senderId: 'b', createdAt: 1 } };
  assert.equal(model.unreadCount(messages, 'a'), 2);
  assert.equal(model.unreadCount(messages, 'a', 'm1'), 1);
  assert.equal(model.unreadCount(messages, 'a', 'm3'), 0);
  assert.equal(model.unreadCount({ ...messages, m4: { senderId: 'b', createdAt: 2 } }, 'a', 'm3'), 1);
});

test('summary uses peer profile, latest location and session presence', () => {
  const summary = model.conversationSummary('a__b', { memberA: 'a', memberB: 'b', messages: { m2: { senderId: 'b', type: 'location', createdAt: 100 }, m1: { senderId: 'a', text: 'Hi', createdAt: 50 } } }, 'a', { b: { name: 'Bình' } }, { b: { connections: { phone: true } } });
  assert.equal(summary.user.name, 'Bình');
  assert.equal(summary.user.isOnline, true);
  assert.equal(summary.lastMessage, '📍 Vị trí');
  assert.equal(summary.unreadCount, 1);
  assert.equal(model.userProfile('b', {}, {}).isOnline, false);
  assert.equal(model.conversationSummary('a__b', { memberA: 'a', memberB: 'b' }, 'a', {}, {}), null);
});

test('summary handles recalled message and image message', () => {
  const recalledSummary = model.conversationSummary('a__b', {
    memberA: 'a', memberB: 'b',
    messages: { m1: { senderId: 'b', text: 'Bí mật', recalled: true, createdAt: 100 } },
  }, 'a', { b: { name: 'Bình' } }, {});
  assert.equal(recalledSummary.lastMessage, 'Tin nhắn đã được thu hồi');

  const imgSummary = model.conversationSummary('a__b', {
    memberA: 'a', memberB: 'b',
    messages: { m1: { senderId: 'b', type: 'image', imageUrl: 'http://img.jpg', createdAt: 100 } },
  }, 'a', { b: { name: 'Bình' } }, {});
  assert.equal(imgSummary.lastMessage, '📷 Hình ảnh');
});

test('group conversation summary with member counts and online presence', () => {
  const groupData = {
    type: 'group',
    name: 'Nhóm Dự Án React Native',
    members: { alice: true, bob: true, charlie: true },
    messages: {
      m1: { senderId: 'bob', text: 'Chào cả nhóm!', createdAt: 200 },
    },
  };
  const statuses = {
    alice: { connections: { c1: true } },
    bob: { connections: { c2: true } },
    charlie: {},
  };
  const summary = model.conversationSummary('group_123', groupData, 'alice', {}, statuses);
  assert.equal(summary.type, 'group');
  assert.equal(summary.name, 'Nhóm Dự Án React Native');
  assert.equal(summary.user.totalMembers, 3);
  assert.equal(summary.user.onlineCount, 2);
  assert.equal(summary.lastMessage, 'Chào cả nhóm!');
});

test('formatLastSeen relative time formats', () => {
  assert.equal(presence.formatLastSeen(null), 'Ngoại tuyến');
  assert.equal(presence.formatLastSeen(undefined), 'Ngoại tuyến');
  const now = Date.now();
  assert.equal(presence.formatLastSeen(now - 10000), 'Vừa mới hoạt động');
  assert.equal(presence.formatLastSeen(now - 5 * 60 * 1000), 'Hoạt động 5 phút trước');
  assert.equal(presence.formatLastSeen(now - 2 * 60 * 60 * 1000), 'Hoạt động 2 giờ trước');
  assert.equal(presence.formatLastSeen(now - 2 * 24 * 60 * 60 * 1000), 'Hoạt động 2 ngày trước');
});

test('Firebase push IDs use binary order, not locale collation', () => {
  const ids = ['-X_a', '-XZa', '-XAa', '-Xaa', '-X-a'];
  const messages = Object.fromEntries(ids.map(id => [id, { senderId: 'b' }]));
  assert.deepEqual(model.orderedMessages(messages).map(m => m.id), [...ids].sort());
});
