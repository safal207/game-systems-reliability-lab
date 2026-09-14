# Multiplayer Reliability Risk Model

This case prioritizes failures by business impact, exploitability, and likelihood rather than by UI visibility.

## P0 — Economy corruption

### Duplicate reward after retry

**Trigger:** client sends an economic action, the server commits it, the acknowledgement is lost, and the client retries.

**Invariant:** one logical action ID may create at most one economic effect.

**Evidence:** deterministic regression test proves the second request is recognized as a duplicate and balance remains unchanged.

### Action-ID collision or malicious reuse

**Trigger:** the same action ID is reused with a different player or payload.

**Invariant:** an existing action ID must be bound to the original economic payload.

**Evidence:** conflicting reuse is rejected instead of silently applying or returning an unrelated receipt.

## P0 — Client authority abuse

### Client-controlled reward value

**Trigger:** a modified client attempts to submit its own reward amount.

**Invariant:** economically meaningful values must be derived from authoritative server state/rules.

**Current demo:** `reward:claim` accepts the action identity and claim type; reward amount is selected server-side.

## P1 — Reconnect inconsistency

**Trigger:** connection drops after a state transition but before the client receives the new state.

**Risk:** client and server disagree about inventory, score, ownership, or round outcome.

**Required production proof:** reconnect must rehydrate from authoritative state, not from client memory.

## P1 — Concurrent ownership / race condition

**Trigger:** two clients attempt to acquire or transfer the same unique resource nearly simultaneously.

**Invariant:** only one valid state transition can win.

**Required production proof:** use an atomic compare-and-set, transaction, unique constraint, or equivalent durable serialization boundary.

## P1 — Stale-state action

**Trigger:** client submits an action based on an old tick/version.

**Risk:** impossible movement, double-spend, invalid collision outcome, or ownership corruption.

**Recommended control:** versioned authoritative state + rejection/reconciliation policy.

## P1 — Load-induced correctness failure

A server can stay reachable while becoming logically unhealthy.

Do not define success as only:

```text
N sockets connected
```

Measure at least:

- successful connection rate
- active event throughput
- p50 / p95 / p99 latency
- server tick or simulation delay
- CPU and memory pressure
- disconnect/reconnect rate
- dropped or duplicated events
- authoritative-state divergence
- economic invariant violations under load

## P2 — Socket/event abuse

Potential controls for a production system:

- authentication and session binding
- event schema validation
- rate limits / quotas
- maximum payload size
- server-side authorization
- replay protection for sensitive actions
- telemetry for abnormal action rates

## Current proof boundary

The in-memory ledger demonstrates the semantic invariant in a single process. It is **not** durable across process restart and is not sufficient by itself for horizontally scaled workers.

A production version should persist the action receipt and state transition atomically in a durable store.
