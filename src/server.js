'use strict';

const http = require('node:http');
const { randomUUID } = require('node:crypto');
const { Server } = require('socket.io');
const { RewardLedger } = require('./reward-ledger');

const PORT = Number(process.env.PORT || 3000);
const ledger = new RewardLedger();

const httpServer = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  res.writeHead(404, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ error: 'not_found' }));
});

const io = new Server(httpServer, {
  cors: { origin: '*' },
});

io.on('connection', (socket) => {
  const suppliedPlayerId = socket.handshake.auth?.playerId;
  socket.data.playerId = suppliedPlayerId || `player-${randomUUID()}`;

  socket.emit('session:ready', {
    playerId: socket.data.playerId,
    balance: ledger.getBalance(socket.data.playerId),
  });

  socket.on('reward:claim', (payload = {}, acknowledge = () => {}) => {
    try {
      const { actionId, claimType } = payload;

      if (claimType !== 'round-win') {
        throw new Error('unsupported claimType');
      }

      // The client does not choose the economic value.
      // Reward authority remains on the server.
      const receipt = ledger.credit({
        playerId: socket.data.playerId,
        actionId,
        amount: 10,
      });

      acknowledge({ ok: true, receipt });
    } catch (error) {
      acknowledge({
        ok: false,
        error: error instanceof Error ? error.message : 'unknown_error',
      });
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`Reliability lab listening on http://localhost:${PORT}`);
});
