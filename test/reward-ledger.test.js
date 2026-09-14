'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { RewardLedger } = require('../src/reward-ledger');

test('same action ID cannot credit the same reward twice', () => {
  const ledger = new RewardLedger();

  const first = ledger.credit({
    playerId: 'player-1',
    actionId: 'round-42-win',
    amount: 10,
  });

  const retry = ledger.credit({
    playerId: 'player-1',
    actionId: 'round-42-win',
    amount: 10,
  });

  assert.equal(first.applied, true);
  assert.equal(first.duplicate, false);
  assert.equal(retry.applied, false);
  assert.equal(retry.duplicate, true);
  assert.equal(ledger.getBalance('player-1'), 10);
});

test('different action IDs can apply independent valid rewards', () => {
  const ledger = new RewardLedger();

  ledger.credit({ playerId: 'player-1', actionId: 'round-1-win', amount: 10 });
  ledger.credit({ playerId: 'player-1', actionId: 'round-2-win', amount: 10 });

  assert.equal(ledger.getBalance('player-1'), 20);
});

test('reusing an action ID with a different payload is rejected', () => {
  const ledger = new RewardLedger();

  ledger.credit({ playerId: 'player-1', actionId: 'economic-action-7', amount: 10 });

  assert.throws(
    () => ledger.credit({ playerId: 'player-2', actionId: 'economic-action-7', amount: 10 }),
    /actionId reuse conflict/
  );
});

test('invalid reward values are rejected before state mutation', () => {
  const ledger = new RewardLedger();

  assert.throws(
    () => ledger.credit({ playerId: 'player-1', actionId: 'bad-1', amount: -10 }),
    /positive finite number/
  );

  assert.equal(ledger.getBalance('player-1'), 0);
});
