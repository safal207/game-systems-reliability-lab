# Game Systems Reliability Lab

Practical QA and reliability engineering for real-time multiplayer games.

This repository is a portfolio lab focused on the failure modes that matter in production multiplayer systems: concurrent actions, duplicate rewards, reconnects, stale state, server authority, Socket.IO behavior, load, and evidence-driven regression testing.

## Portfolio Case #1 — Multiplayer Snake Reliability

The first case models a small real-time multiplayer game backend and tests one high-value invariant:

> A client retry, duplicate event, or lost acknowledgement must never create an additional economic reward.

The demo uses a server-authoritative Socket.IO flow with idempotent action IDs. The client may request an action, but the server owns reward value and state transition authority.

### What this case demonstrates

- server-authoritative state changes
- idempotent reward processing
- duplicate/replay protection
- conflicting action-ID detection
- deterministic regression tests
- Socket.IO smoke-load harness
- explicit separation between `connected clients` and `healthy concurrent gameplay`

### Important scope note

This repository does **not** claim that 1,000 concurrent players have been proven. The load harness is evidence tooling, not a performance claim. A production-scale result should include repeatable runs, environment metadata, latency percentiles, event throughput, CPU/memory pressure, state correctness, and failure thresholds.

## Quick start

```bash
npm install
npm test
npm start
```

In another terminal:

```bash
npm run load:smoke -- 100
```

The final argument is the number of simulated Socket.IO clients.

## Core invariant

For any accepted economic action ID `A`:

```text
first valid A       -> effect may be applied once
same A retried      -> same outcome, no second effect
same A, new payload -> reject as conflict
lost ACK + retry    -> no duplicate reward
```

## Repository map

```text
src/
  reward-ledger.js       # deterministic economic state + idempotency guard
  server.js              # minimal Socket.IO authoritative server

test/
  reward-ledger.test.js  # regression proof for duplicate/replay behavior

scripts/
  socket-load-smoke.js   # concurrent Socket.IO smoke-load harness

docs/
  RISK_MODEL.md          # prioritized multiplayer failure model
  TEST_STRATEGY.md       # evidence and acceptance strategy
```

## Why this matters

In a multiplayer economy, a visually correct client is not enough. A robust launch requires proof that retries, reconnects, races, and duplicate messages cannot corrupt authoritative state.

The engineering approach used here is:

```text
risk -> invariant -> reproducible test -> evidence -> fix -> regression proof
```

## Next cases

Planned portfolio extensions:

1. reconnect + lost acknowledgement recovery
2. concurrent ownership transfer / anti-duplication
3. authoritative movement and collision consistency
4. Socket.IO saturation and latency thresholds
5. persistence across process restart
6. Roblox DataStore / economy reliability patterns
7. Minecraft plugin / server transaction reliability

## License

MIT
