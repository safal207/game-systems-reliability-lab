# Socket.IO #5512 runner static review

Decision: **no blocking defect found for the sixteen-case bounded experiment**. Ready for root's runtime verification. This reviewer read source and package metadata only; no Socket.IO, Zod, ledger or runner code was executed, and nothing was posted externally.

Reviewed `lab/benchmarks/socketio-5512/run-matrix.cjs`, its scope/package/lock files, the owned `src/reward-ledger.js`, and the relevant installed client disconnect path. Installed metadata and lockfile both name Socket.IO server/client 4.8.4 and Zod 4.6.5. The legacy lab's 4.8.3 declarations are unchanged; the benchmark imports its own installed packages. The output explicitly marks inspected upstream source execution NOT_RUN and distinguishes the published-package runtime.

## Main assertions accepted

- Callback and Promise rows call distinct actual native APIs: timeout-aware `emit` and `emitWithAck`. Both retain the native error name/message separately from the raw wire ACK and userland result.
- Invalid-request and invalid-response rows assert a null native transport error. The custom rejection envelope is not misrepresented as a Socket.IO validation API. Response schema validation follows receipt of the native ACK.
- Zod is invoked through `~standard.validate`. A thenable result throws an explicit unsupported synchronous-fixture error instead of being accepted or reclassified as a schema rejection. The schemas used here do not coerce or transform business identity.
- Request validation precedes the selected business-handler counter and the ledger call. Invalid request expects zero handler calls and zero mutation.
- The zero-effect timeout records a received event, one handler entry, then deliberately withholds ACK without mutation. The one-effect timeout records the actual mutation before withholding ACK. Both must expose equal native error name/message and equal userland result; client classification does not consume the receiver effect count.
- Native retries are explicitly zero, automatic reconnection is disabled, and each row has a fresh server, client and ledger. Request and handler counts would expose hidden extra deliveries.
- A server disconnect is called synchronously after the balance transition. The trace additionally requires an effect record before the first client-settlement record in every effectful row. There is no short sleep pretending to establish ordering.
- Effects are recorded from actual balance deltas, independently of ACK `balanceAfter`, receipt `applied` or response validity. Literal expected effect counts, balance and handler counts are asserted separately.
- Retry waits for the first timeout after exactly one effect and balance 10, reconstructs a client explicitly, and preserves the same request object values. The ledger and fixed synthetic player remain within the same row. The guarded branch calls the unchanged owned `RewardLedger`; the negative control intentionally bypasses its dedupe with a simple application balance sink.
- Guarded retry requires one retained effect/balance 10 and duplicate=true. Unguarded retry requires two retained effects/balance 20 and duplicate=false. The matrix does not alter action IDs or clear state to manufacture the contrast.
- Each row closes its client(s) and server in finally. The synchronous application handlers schedule no delayed mutation. A watchdog or assertion failure exits nonzero; a complete success artifact is only written after all sixteen rows and timeout-equivalence assertions finish.

## Wording and observation limits

1. The timeout-no-effect row **does enter the business handler** (expected count 1). Describe it as a handler that deliberately performs no mutation and sends no ACK. Only invalid-request demonstrates rejection before the business handler. This differs from the earlier optional design wording but preserves the useful paired-timeout comparison.
2. The scope still says “lost ACK” once. The implemented injection is an ACK deliberately withheld by the application; it does not observe a packet being lost in transport. Likewise the disconnect is server initiated.
3. The trace records `client_settled` after decoding. It records the one result observed by the harness, not every raw callback invocation: the internal Promise would absorb duplicate resolves. Do not claim a separately measured exactly-once native callback delivery guarantee. No extra assertion is needed for the current effect-boundary claim.
4. Zod issue details are not retained, only the derived validation classification and raw invalid ACK/request. That is sufficient for these fixed shape-error worlds; do not describe the artifact as testing RFC error shape, exhaustive issue fidelity or asynchronous validation.
5. The successful response schema checks a narrow receipt shape. It does not prove response authority, binding to an arbitrary requested action, or truth of a remote balance. Those broader properties are outside this fixture; the receiver's local balance observation supplies the measured effect evidence.
6. The unguarded sink is deliberately different application policy. Its two effects are a positive observation of the intended negative control, not a discovered Socket.IO defect or a native retry default.
7. The ledger's duplicate receipt is semantically marked duplicate and differs from the original ACK. This is not byte-identical response replay, restart persistence, distributed dedupe or universal exactly-once execution.

No broad new scenarios or runner changes are required by this static review. Runtime acceptance still depends on the actual sixteen row observations, expected installed package provenance, and retained process output.
