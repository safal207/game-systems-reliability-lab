'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { io: connect } = require('socket.io-client');
const { createReliabilityServer } = require('../src/server');

function openClient(url, playerId) {
  return new Promise((resolve, reject) => {
    const socket = connect(url, {
      auth: { playerId },
      transports: ['websocket'],
      reconnection: false,
      timeout: 2000,
    });

    socket.once('connect', () => resolve(socket));
    socket.once('connect_error', reject);
  });
}

function claim(socket, payload) {
  return new Promise((resolve, reject) => {
    socket.timeout(2000).emit('reward:claim', payload, (error, response) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(response);
    });
  });
}

function serverUrl(address) {
  return `http://127.0.0.1:${address.port}`;
}

test('lost ACK followed by reconnect + retry does not duplicate reward', async (t) => {
  const app = createReliabilityServer({ ackDelayMs: 80 });
  const address = await app.start(0);
  const url = serverUrl(address);

  t.after(async () => app.stop());

  const firstClient = await openClient(url, 'player-retry');

  // The server applies the action immediately but delays its ACK. The client
  // disconnects before receiving the outcome, leaving the result uncertain.
  firstClient.emit('reward:claim', {
    actionId: 'round-99-win',
    claimType: 'round-win',
  });

  await new Promise((resolve) => setTimeout(resolve, 20));
  firstClient.disconnect();

  const retryClient = await openClient(url, 'player-retry');
  t.after(() => retryClient.disconnect());

  const retry = await claim(retryClient, {
    actionId: 'round-99-win',
    claimType: 'round-win',
  });

  assert.equal(retry.ok, true);
  assert.equal(retry.receipt.applied, false);
  assert.equal(retry.receipt.duplicate, true);
  assert.equal(retry.receipt.balanceAfter, 10);
  assert.equal(app.ledger.getBalance('player-retry'), 10);
});

test('20 concurrent duplicate claims produce exactly one economic effect', async (t) => {
  const app = createReliabilityServer();
  const address = await app.start(0);
  const url = serverUrl(address);

  t.after(async () => app.stop());

  const clients = await Promise.all(
    Array.from({ length: 20 }, () => openClient(url, 'player-race'))
  );

  t.after(() => clients.forEach((socket) => socket.disconnect()));

  const responses = await Promise.all(
    clients.map((socket) =>
      claim(socket, {
        actionId: 'shared-round-win',
        claimType: 'round-win',
      })
    )
  );

  const applied = responses.filter((response) => response.receipt.applied);
  const duplicates = responses.filter((response) => response.receipt.duplicate);

  assert.equal(responses.every((response) => response.ok), true);
  assert.equal(applied.length, 1);
  assert.equal(duplicates.length, 19);
  assert.equal(responses.every((response) => response.receipt.balanceAfter === 10), true);
  assert.equal(app.ledger.getBalance('player-race'), 10);
});

test('client-supplied reward value cannot override server authority', async (t) => {
  const app = createReliabilityServer();
  const address = await app.start(0);
  const url = serverUrl(address);

  t.after(async () => app.stop());

  const client = await openClient(url, 'player-authority');
  t.after(() => client.disconnect());

  const response = await claim(client, {
    actionId: 'authority-check',
    claimType: 'round-win',
    amount: 1_000_000,
  });

  assert.equal(response.ok, true);
  assert.equal(response.receipt.amount, 10);
  assert.equal(response.receipt.balanceAfter, 10);
  assert.equal(app.ledger.getBalance('player-authority'), 10);
});
