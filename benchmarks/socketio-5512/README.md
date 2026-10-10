# Acknowledgement errors and application effects: Socket.IO #5512

An executed userland example for [GermanJablo's Standard Schema RFC](https://github.com/socketio/socket.io/issues/5512) and darrachequesne's acknowledgement/error questions. This is not a native contract implementation or a newly discovered Socket.IO defect. Existing upstream tests already cover timeout, disconnect and retries; this example adds independently retained application-effect counts and validation-stage controls.

Runtime: published `socket.io==4.8.4`, `socket.io-client==4.8.4`, `zod==4.6.5`. Static upstream source review: `1eaa582d3b453e3e6f522300ed05b10da0a0799b`; that checkout was **not executed**. The pinned package lock contains registry integrity digests. Local environment: Node 24.19.0, Linux. The source of the existing application `RewardLedger` is unchanged from owned repository base `f2318cc6d3ae6f717f0c43cbbbbda530efa39505`.

## Observations

Each row was checked using both callback and `emitWithAck`. Zod's synchronous `~standard.validate` interface is used explicitly in a server request helper and client response decoder. The wire envelope is fixture-specific; it does not select the RFC's tuple or Node-style callback design.

| Scenario | Business handler calls | Independently observed effects | Native transport | Userland result |
|---|---:|---:|---|---|
| Valid request and ACK | 1 | 1 | Successful ACK | OK |
| Invalid request, rejected before business handler | 0 | 0 | Successful ACK containing fixture rejection | REQUEST_VALIDATION_ERROR |
| Effect applied, invalid response received | 1 | 1 | Successful ACK | RESPONSE_VALIDATION_ERROR |
| Handler skips effect and deliberately withholds ACK | 1 | 0 | Timeout | TIMEOUT / UNKNOWN |
| Handler applies effect and deliberately withholds ACK | 1 | 1 | Timeout | TIMEOUT / UNKNOWN |
| Handler applies effect, then server disconnects | 1 | 1 | Disconnect error | DISCONNECTED / UNKNOWN |
| Same-ID retry after withheld ACK, application dedupe | 2 | 1 | First timeout; retry successful | Duplicate receipt; balance 10 |
| Same-ID retry, deliberately unguarded application | 2 | 2 | First timeout; retry successful | Negative control; balance 20 |

The two timeout worlds assert **identical native Error name/message and identical client outcomes** despite effect counts zero and one. Client classifications do not use the server's out-of-band balance/effect observations. Post-effect scenarios assert the recorded effect precedes observed client settlement. Invalid request invokes the ingress validator, but not the selected business handler.

All 16 case checks pass per attempt. This includes observing two effects in the deliberately unsafe retry control: test success does **not** label that application's behavior safe. Two fresh-process matrix attempts (32 case executions) are retained in `evidence/`; each uses fresh server/client contexts per row. Existing root regression suite: 7 tests passed locally. Errors and UNKNOWN states remain errors and UNKNOWN in the raw observations.

## Reproduce

Use a checkout of this evidence branch or the immutable commit linked from its PR/issue comment. Run from the repository root:

```bash
cd benchmarks/socketio-5512
npm ci --ignore-scripts --no-audit --no-fund
node verify-evidence.cjs
node run-matrix.cjs --output artifacts/my-attempt.json
```

Output files must be new: earlier evidence is never overwritten. Each attempt exits nonzero on an assertion failure, unexpected transport error, unsupported asynchronous validator, watchdog timeout, or execution error. `npm test` performs the same 16 checks and writes `artifacts/ci-results.json`.

This directory has its own dependencies and lock; the root lab continues to use Socket.IO 4.8.3. Runtime result files report actually resolved package versions and digests rather than treating a source branch name as the executing package.

## Boundaries and next step

The application listens only on `127.0.0.1` at an ephemeral port. Native retries and automatic reconnection are disabled; the retry control explicitly constructs a new client while preserving player, action ID and request. The existing `RewardLedger` provides process-memory dedupe. The unguarded twin replaces the ledger mutation path with a direct balance increment, retaining the same request, player and transport. Duplicate receipts are not byte-identical ACK replay.

ACKs are deliberately withheld; network packet loss is not demonstrated. Disconnect is server-initiated after the effect. Synthetic balances are not financial settlement. No server/process crash, durable datastore, multiple replicas, real game users, live provider, arbitrary schema compatibility, async-validation ordering, receipt authenticity or exactly-once guarantee is established. Schema error codes come from the userland adapter, not Socket.IO core. Receipt shape validation alone does not establish authority or binding.

The implication for the proposed error union is bounded: response validation, timeout and disconnect errors should not imply that no effect happened or that retrying with a new identity is safe. Only this helper's pre-handler rejection proves zero effects by its selected handler. Application idempotency remains a separate responsibility.

The packet's manifest detects changes in listed files and explicitly referenced source files; it does not prove authenticity or semantic truth. `provenance.json` and `REVIEWS.md` separate execution, source inspection, review, CI and disclosure authority. After this example, maintainer agreement on the proposed API can guide native regression placement. AI-assisted implementation and independent agent review by safal207; proposal and existing transport work belong to their original authors.
