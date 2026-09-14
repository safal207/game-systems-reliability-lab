'use strict';

const { io } = require('socket.io-client');
const { randomUUID } = require('node:crypto');

const target = process.env.TARGET_URL || 'http://localhost:3000';
const clients = Number(process.argv[2] || 50);

if (!Number.isInteger(clients) || clients <= 0) {
  console.error('Client count must be a positive integer.');
  process.exit(1);
}

const latencies = [];
let completed = 0;
let failures = 0;

function percentile(values, p) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[index];
}

function finishIfDone() {
  if (completed !== clients) return;

  const summary = {
    target,
    clients,
    successes: clients - failures,
    failures,
    p50_ms: percentile(latencies, 50),
    p95_ms: percentile(latencies, 95),
    max_ms: latencies.length ? Math.max(...latencies) : null,
  };

  console.log(JSON.stringify(summary, null, 2));
  process.exit(failures > 0 ? 1 : 0);
}

for (let i = 0; i < clients; i += 1) {
  const playerId = `load-player-${i}`;
  const socket = io(target, {
    auth: { playerId },
    transports: ['websocket'],
    reconnection: false,
    timeout: 5000,
  });

  const startedAt = process.hrtime.bigint();

  const done = (failed) => {
    if (socket.disconnected === false) socket.disconnect();
    if (failed) failures += 1;
    completed += 1;
    finishIfDone();
  };

  socket.on('connect', () => {
    socket.timeout(5000).emit(
      'reward:claim',
      { actionId: `load-${randomUUID()}`, claimType: 'round-win' },
      (error, response) => {
        if (error || !response?.ok) {
          done(true);
          return;
        }

        const elapsedMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
        latencies.push(Number(elapsedMs.toFixed(2)));
        done(false);
      }
    );
  });

  socket.on('connect_error', () => done(true));
}
