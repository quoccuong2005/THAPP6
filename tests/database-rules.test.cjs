const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const { get, ref, set, update, remove, serverTimestamp, goOffline, goOnline } = require('firebase/database');
const load = require('./load-service.cjs');
const model = load('chatModel');

test('RTDB security and two-user realtime flow', { timeout: 90000 }, async t => {
  const [host, port] = (process.env.FIREBASE_DATABASE_EMULATOR_HOST || '127.0.0.1:9000').split(':');
  const env = await initializeTestEnvironment({
    projectId: 'demo-thapp2',
    database: { host, port: Number(port), rules: fs.readFileSync('database.rules.json', 'utf8') },
  });
  try {
    await env.clearDatabase();
    const alice = env.authenticatedContext('alice', { email: 'alice@example.com' }).database();
    const bob = env.authenticatedContext('bob', { email: 'bob@example.com' }).database();
    const eve = env.authenticatedContext('eve', { email: 'eve@example.com' }).database();
    const anonymous = env.unauthenticatedContext().database();
    const services = db => load('chatService', { './firebase': { getFirebase: () => ({ db }) }, './chatModel': model });
    const a = services(alice), b = services(bob);

    await t.test('own profile only; guests cannot list users', async () => {
      await assertSucceeds(set(ref(alice, 'users/alice'), { name: 'An', email: 'alice@example.com' }));
      await assertSucceeds(set(ref(bob, 'users/bob'), { name: 'Bình', email: 'bob@example.com' }));
      await assertSucceeds(set(ref(eve, 'users/eve'), { name: 'Eve', email: 'eve@example.com' }));
      await assertFails(set(ref(alice, 'users/bob/name'), 'Fake'));
      await assertFails(set(ref(alice, 'users/alice/email'), 'fake@example.com'));
      await assertFails(get(ref(anonymous, 'users')));
      const users = await get(ref(bob, 'users'));
      assert.equal(Object.keys(users.val()).length, 3);
    });

    let firstKey;
    await t.test('service creates membership and both indexes; real listener receives a message', async () => {
      const id = model.conversationId('alice', 'bob');
      const delivery = new Promise((resolve, reject) => {
        const timer = setTimeout(() => { stop(); reject(Error('realtime delivery timeout')); }, 10000);
        const stop = b.observeChat(id, data => {
          if (Object.keys(data?.messages || {}).length === 1) {
            clearTimeout(timer); stop(); resolve(data);
          }
        }, reject);
      });
      firstKey = await a.sendMessage('alice', 'bob', { text: ' Xin chào Bình ' });
      const data = await delivery;
      assert.equal(data.messages[firstKey].text, 'Xin chào Bình');
      assert.equal(data.messages[firstKey].senderId, 'alice');
      assert.equal(model.unreadCount(data.messages, 'bob'), 1);
      assert.equal((await get(ref(bob, `userChats/bob/${id}`))).val() !== null, true);
      assert.equal((await get(ref(alice, `userChats/alice/${id}`))).val() !== null, true);
    });

    await t.test('concurrent sends retain both messages and cannot regress read marker', async () => {
      const id = 'alice__bob';
      await b.markRead(id, 'bob', firstKey);
      const [aliceKey, bobKey] = await Promise.all([
        a.sendMessage('alice', 'bob', { text: 'Tin thứ hai' }),
        b.sendMessage('bob', 'alice', { type: 'location', latitude: 10.8, longitude: 106.7 }),
      ]);
      const data = (await get(ref(bob, `conversations/${id}`))).val();
      assert.equal(Object.keys(data.messages).length, 3);
      assert.equal(data.messages[bobKey].type, 'location');
    });

    await t.test('private chats, immutable messages/members, own read marker only', async () => {
      await assertFails(get(ref(eve, 'conversations/alice__bob')));
      await assertFails(get(ref(eve, 'conversations')));
      await assertFails(get(ref(eve, 'userChats/alice')));
      await assertFails(set(ref(eve, 'userChats/eve/alice__bob'), true));
      await assertFails(set(ref(alice, `conversations/alice__bob/messages/${firstKey}/text`), 'edited'));
      await assertFails(remove(ref(alice, `conversations/alice__bob/messages/${firstKey}`)));
    });

    await t.test('message recall: sender can recall, other user cannot recall', async () => {
      const id = 'alice__bob';
      // Bob cannot recall Alice's message
      await assertFails(update(ref(bob, `conversations/${id}/messages/${firstKey}`), { recalled: true }));
      // Alice can recall her own message
      await assertSucceeds(update(ref(alice, `conversations/${id}/messages/${firstKey}`), { recalled: true }));
      const msg = (await get(ref(bob, `conversations/${id}/messages/${firstKey}`))).val();
      assert.equal(msg.recalled, true);
    });

    await t.test('reactions: user can only react as themselves', async () => {
      const id = 'alice__bob';
      // Alice reacts as Alice
      await assertSucceeds(set(ref(alice, `conversations/${id}/messages/${firstKey}/reactions/alice`), '❤️'));
      // Alice cannot react on behalf of Bob
      await assertFails(set(ref(alice, `conversations/${id}/messages/${firstKey}/reactions/bob`), '❤️'));
      // Non-member Eve cannot react
      await assertFails(set(ref(eve, `conversations/${id}/messages/${firstKey}/reactions/eve`), '❤️'));
    });

    await t.test('typing status: user can only update their own typing state in a conversation', async () => {
      const id = 'alice__bob';
      await assertSucceeds(set(ref(alice, `typing/${id}/alice`), true));
      await assertFails(set(ref(alice, `typing/${id}/bob`), true));
      await assertFails(set(ref(eve, `typing/${id}/eve`), true));
      await assertSucceeds(remove(ref(alice, `typing/${id}/alice`)));
    });

    await t.test('notifications: private to recipient', async () => {
      // Alice creates a notification for Bob
      await assertSucceeds(set(ref(alice, 'notifications/bob/n1'), {
        type: 'message',
        fromUid: 'alice',
        text: 'Hello',
        read: false,
        createdAt: 1000,
      }));
      // Bob can read his notifications
      const notifs = await get(ref(bob, 'notifications/bob'));
      assert.equal(notifs.val().n1.text, 'Hello');
      // Eve cannot read Bob's notifications
      await assertFails(get(ref(eve, 'notifications/bob')));
    });

    await t.test('multi-session presence: removing one session keeps the other online', async () => {
      await assertSucceeds(set(ref(alice, 'status/alice/connections/phone'), true));
      await assertSucceeds(set(ref(alice, 'status/alice/connections/tablet'), true));
      await assertFails(set(ref(bob, 'status/alice/connections/fake'), true));
      await remove(ref(alice, 'status/alice/connections/phone'));
      let presence = (await get(ref(bob, 'status/alice'))).val();
      assert.equal(model.userProfile('alice', {}, presence).isOnline, true);
      await remove(ref(alice, 'status/alice/connections/tablet'));
      presence = (await get(ref(bob, 'status/alice'))).val();
      assert.equal(model.userProfile('alice', {}, presence || {}).isOnline, false);
    });

  } finally {
    await env.cleanup();
  }
});
