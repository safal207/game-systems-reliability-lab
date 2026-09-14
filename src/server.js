'use strict';

const http = require('node:http');
const { randomUUID } = require('node:crypto');
const { Server } = require('socket.io');
const { RewardLedger } = require('./reward-ledger');

const DEFAULT_PORT = Number(process.env.PORT || 3000);

function createReliabilityServer({ ledger = new RewardLedger(), ackDelayMs = 0 } = {}) {
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
      let response;

      try {
        const { actionId, claimType } = payload;

        if (claimType !== 'round-win') {
          throw new Error('unsupported claimType');
        }

        // Economic value and state transition authority stay on the server.
        const receipt = ledger.credit({
          playerId: socket.data.playerId,
          actionId,
          amount: 10,
        });

        response = { ok: true, receipt };
      } catch (error) {
        response = {
          ok: false,
          error: error instanceof Error ? error.message : 'unknown_error',
        };
      }

      if (ackDelayMs > 0) {
        setTimeout(() => acknowledge(response), ackDelayMs);
      } else {
        acknowledge(response);
      }
    });
  });

  async function start(port = DEFAULT_PORT) {
    await new Promise((resolve, reject) => {
      httpServer.once('error', reject);
      httpServer.listen(port, '127.0.0.1', () => {
        httpServer.off('error', reject);
        resolve();
      });
    });

    return httpServer.address();
  }

  async function stop() {
    await new Promise((resolve) => {
      io.close(() => {
        if (!httpServer.listening) {
          resolve();
          return;
        }

        httpServer.close(() => resolve());
      });
    });
  }

  return { httpServer, io, ledger, start, stop };
}

if (require.main === module) {
  const app = createReliabilityServer();
  app.start(DEFAULT_PORT).then(() => {
    console.log(`Reliability lab listening on http://127.0.0.1:${DEFAULT_PORT}`);
  });
}

module.exports = { createReliabilityServer };
