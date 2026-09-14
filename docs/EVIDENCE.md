# Evidence Register — Portfolio Case #1

## Claim under test

A retry, reconnect, duplicate message, or concurrent duplicate request must not create more than one economic reward for the same accepted action ID.

## Verified automated run

- Date: 2026-09-14
- GitHub Actions workflow: `reliability-regression`
- Run: [#3](https://github.com/safal207/game-systems-reliability-lab/actions/runs/34862266720)
- Commit: `8c4d98e07d0f6c79f79e8e23fadeae2823585922`
- Runner: `ubuntu-latest`
- Result: **PASS**
- Test command: `npm test` (`node --test`)

The workflow's deterministic regression-test step completed successfully on a clean GitHub-hosted runner.

## Proof matrix

| ID | Scenario | Expected invariant | Automated evidence |
| --- | --- | --- | --- |
| R-01 | Same action ID is submitted twice | Only first request changes balance | `test/reward-ledger.test.js` |
| R-02 | Different valid action IDs | Each independent action may apply once | `test/reward-ledger.test.js` |
| R-03 | Action ID is reused with conflicting player identity | Conflict is rejected | `test/reward-ledger.test.js` |
| R-04 | Invalid economic value | State is not mutated | `test/reward-ledger.test.js` |
| S-01 | Server processes reward, ACK is delayed, client disconnects, reconnects and retries same action | Retry returns duplicate receipt; balance remains `10` | `test/socket-integration.test.js` |
| S-02 | 20 connected clients submit the same action ID for the same player | Exactly `1` applied receipt + `19` duplicate receipts; balance remains `10` | `test/socket-integration.test.js` |
| S-03 | Client attempts to send `amount: 1_000_000` | Server ignores client value and applies authoritative reward `10` | `test/socket-integration.test.js` |

## What the proof means

The current implementation demonstrates that, inside one Node.js server process with one in-memory authoritative ledger:

1. a retry after an uncertain client outcome does not create a second effect;
2. concurrent duplicate Socket.IO claims converge on one economic state transition;
3. the client cannot choose the reward amount;
4. conflicting action identity is rejected instead of silently reinterpreted.

## What the proof does **not** mean

This evidence is deliberately bounded. It does not yet prove:

- exactly-once effects across multiple server replicas;
- persistence across process crash/restart;
- idempotency under datastore failover or replication lag;
- 1,000 healthy concurrent gameplay sessions;
- collision/movement correctness;
- Android client behavior;
- production security hardening.

Those require separate evidence rather than extrapolation from a passing unit/integration suite.

## Performance evidence rule

`connected sockets != healthy concurrent players`

A production concurrency claim should include at minimum:

- connected and actively-playing client counts;
- event throughput;
- p50 / p95 / p99 end-to-end latency;
- timeout and disconnect rate;
- event-loop lag;
- CPU and memory pressure;
- datastore latency/contention;
- state-divergence checks;
- economic invariant checks during and after load;
- explicit acceptance thresholds.

## Reproduce

```bash
npm install
npm test
```

For the bounded Socket.IO smoke harness:

```bash
npm start
npm run load:smoke -- 100
```

A smoke run is evidence collection tooling, not by itself a production capacity claim.
