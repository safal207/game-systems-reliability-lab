'use strict';

class RewardLedger {
  constructor() {
    this.balances = new Map();
    this.receipts = new Map();
  }

  getBalance(playerId) {
    return this.balances.get(playerId) ?? 0;
  }

  credit({ playerId, actionId, amount }) {
    if (!playerId || !actionId) {
      throw new Error('playerId and actionId are required');
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error('amount must be a positive finite number');
    }

    const fingerprint = JSON.stringify({ playerId, amount });
    const existing = this.receipts.get(actionId);

    if (existing) {
      if (existing.fingerprint !== fingerprint) {
        throw new Error('actionId reuse conflict');
      }

      return {
        actionId,
        playerId,
        amount,
        applied: false,
        duplicate: true,
        balanceAfter: existing.balanceAfter,
      };
    }

    const balanceAfter = this.getBalance(playerId) + amount;
    this.balances.set(playerId, balanceAfter);
    this.receipts.set(actionId, {
      fingerprint,
      playerId,
      amount,
      balanceAfter,
    });

    return {
      actionId,
      playerId,
      amount,
      applied: true,
      duplicate: false,
      balanceAfter,
    };
  }
}

module.exports = { RewardLedger };
