# Evidence-Driven Test Strategy

The goal is not to maximize test count. The goal is to prove or falsify the invariants that protect multiplayer state and economy.

## Layer 1 — Deterministic domain tests

Run without networking.

Current coverage:

1. first valid economic action applies once
2. retry of the same action is recognized as duplicate
3. independent action IDs apply independently
4. action-ID reuse with a conflicting payload is rejected
5. invalid reward values cannot mutate state

Command:

```bash
npm test
```

## Layer 2 — Socket.IO contract tests

Target behavior:

- session receives an authoritative player ID/state
- supported claim returns a receipt
- unsupported claim is rejected
- client cannot choose reward value
- repeated action ID returns duplicate receipt without additional effect
- acknowledgement timeout + retry preserves the invariant

These are the next automated tests to add.

## Layer 3 — Concurrency tests

Target scenarios:

- many independent players submit valid actions concurrently
- same logical action is sent concurrently more than once
- unique ownership is contested by two players
- reconnect overlaps with an in-flight action

The key assertion is correctness under contention, not only response speed.

## Layer 4 — Smoke load

Start the lab:

```bash
npm start
```

Then:

```bash
npm run load:smoke -- 100
```

The harness reports success/failure plus basic p50/p95/max request latency.

This is intentionally a smoke harness. It does not simulate full gameplay ticks, movement broadcasts, collision computation, database I/O, mobile network behavior, or production infrastructure.

## Production-scale acceptance model

A statement such as “supports 1,000 concurrent players” should have a defined workload and thresholds.

Example evidence contract:

```text
workload:
  1,000 authenticated clients
  realistic movement/event rate
  economy actions mixed into traffic
  reconnect churn included

observe:
  connection success
  event throughput
  p50/p95/p99 latency
  CPU/memory
  event loss/duplication
  state divergence
  invariant failures

pass only if:
  thresholds are declared before the run
  correctness invariants remain true
  results are reproducible
```

## Evidence format for portfolio/client work

For each material finding:

```text
Risk
→ Preconditions
→ Reproduction
→ Expected invariant
→ Actual result
→ Evidence
→ Fix / mitigation
→ Regression proof
```

This keeps the portfolio focused on verifiable engineering outcomes instead of screenshots without context.
