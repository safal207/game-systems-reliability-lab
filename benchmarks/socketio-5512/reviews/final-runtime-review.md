# Independent runtime-packet review: Socket.IO #5512

Disposition: **PASS within the stated userland fixture bound; no runtime blocker found.** Final publication still requires the planned manifest/review assembly and a reachable published packet. This reviewer inspected code, dependencies, retained JSON and documentation without executing the fixture, its integrity verifier, installs, or GitHub mutations.

Reviewed packet: `lab/benchmarks/socketio-5512`; workflow: `lab/.github/workflows/socketio-5512.yml`. Review captured both completed attempts, not an earlier one-attempt draft.

## Semantic cross-check

Both JSON files contain exactly the same complete set of 16 unique cases: eight controls under callback and eight under `emitWithAck`. Their non-trace case contents agree, their attempt UUIDs differ, and each records 16 passing case checks and zero failures. UUIDs and timestamps distinguish the retained attempts; fresh-process execution is reported by the producer, not independently rerun by this reviewer.

| Control, per API and attempt | Handler calls | Effects | End balance | First client result |
|---|---:|---:|---:|---|
| Valid ACK | 1 | 1 | 10 | OK |
| Invalid request | 0 | 0 | 0 | REQUEST_VALIDATION_ERROR |
| Invalid response after mutation | 1 | 1 | 10 | RESPONSE_VALIDATION_ERROR |
| Deliberately withheld ACK, no mutation | 1 | 0 | 0 | TIMEOUT / UNKNOWN |
| Deliberately withheld ACK after mutation | 1 | 1 | 10 | TIMEOUT / UNKNOWN |
| Server disconnect after mutation | 1 | 1 | 10 | DISCONNECTED / UNKNOWN |
| Reconstructed client, same-ID guarded retry | 2 | 1 | 10 | TIMEOUT / UNKNOWN |
| Reconstructed client, same-ID unguarded retry | 2 | 2 | 20 | TIMEOUT / UNKNOWN |

Independently parsed all 32 retained rows against literal expected counts, case identity, ingress count, effect-list length, actual balance, expected fields and trace sequence. The paired timeout worlds have identical complete first-client observations, including raw native `Error` / `operation has timed out`, with receiver effects 0 and 1. Decoder input contains no ledger/balance oracle. The no-effect timeout enters the business handler once; it does not masquerade as a pre-handler rejection.

Both validation-error controls record successful native transport (`transport_error: null` and an ACK payload). Request validation rejects before the selected business handler; response validation rejects the received response after one mutation. These codes belong to the explicit Zod Standard Schema userland helper/decoder. No native `contract` behavior is asserted.

Every recorded first effect precedes the first client-settlement trace event. Each retry preserves the same literal request and business action ID, reconstructs the client explicitly, and observes a second successful ACK. Guarded retry records application deduplication and one effect; the unsafe control records a second actual balance transition and two effects. The effect oracle observes balance changes, not `receipt.applied`, response validity or ACK success. Native retries and automatic reconnection are disabled.

## Dependency and source identity

Nested package manifest, lock entries, installed package metadata and both result files agree on `socket.io` 4.8.4, `socket.io-client` 4.8.4 and `zod` 4.6.5. All installed dependency entries in the nested lock have integrity digests. The actually inspected client entrypoint digest agrees with both result files. Root manifest and root installed server/client packages remain 4.8.3. Nested resolution does not silently borrow root 4.8.3.

Both attempts' recorded runner and ledger hashes match the files reviewed. Read-only `git diff f2318cc6d3ae6f717f0c43cbbbbda530efa39505 -- src/reward-ledger.js` is empty. Static source review SHA `1eaa582d3b453e3e6f522300ed05b10da0a0799b` remains explicitly `NOT_RUN`; execution concerns published packages.

| Artifact | SHA-256 |
|---|---|
| `evidence/attempt-1.json` | `57c4786ea9992bdc7317070adc6ccd5e4dda9dcdba55699a63a3212c90fad1e4` |
| `evidence/attempt-2.json` | `a523a0c52b4e240972c7ffc498d6dc145450b97425207cd69410d0556847d3e9` |
| `run-matrix.cjs` | `2b55f35c743a1a3e01336deaf7181a9f2968fe4e9241a2871d4044b4e9062267` |
| Root `src/reward-ledger.js` | `a200817c366406923ee9d6e41f86f787eb4d88a5f243ff55b61e0716c473522b` |
| Resolved client entrypoint | `6b39eee0bb9bfe63c29d350d20176648f2e8cc30bb60783bad8841840925f8fa` |
| `package-lock.json` | `eaebe5f837ba3f36613dd4adc8048483d7cd57f180f6f5e662dc7bf36672367e` |

## Reproduction and CI bound

Instructions correctly select the nested directory and pinned lock, then run the integrity verifier and matrix into a new output path. Existing evidence is protected by both an existence check and exclusive creation. Assertion failure, unexpected native error, execution error, asynchronous validator or watchdog timeout yields nonzero exit; success retains the original error/UNKNOWN observations rather than relabeling them safe. `npm test` requires a fresh `artifacts/ci-results.json` path, which a clean CI checkout provides.

Workflow installs nested dependencies with lifecycle scripts disabled, verifies retained-file membership/integrity, and executes a new semantic matrix on Node 20 and 24. Both action commit SHAs were verified through read-only GitHub commit retrieval: checkout `11d5960a326750d5838078e36cf38b85af677262`, setup-node `49933ea5288caeca8642d1e84afbd3f7d6820020`. Workflow existence is not an executed CI result. The current provenance correctly leaves dedicated own CI pending and upstream suites unrun. Root seven-regression success is producer-reported and was not rerun in this review.

The byte verifier does not adjudicate semantic truth or authenticity; fresh semantic assertions occur in the runner. Future workflow results are printed in CI logs but `artifacts/ci-results.json` is not uploaded by this workflow. This is a nonblocking retention limitation, not a matrix correctness failure.

## Final assembly gates and minor wording

1. Assemble `manifest.json` and `REVIEWS.md`, then actually verify their final membership and referenced source hashes. At review time these were deliberately pending; provenance's already-present phrase “SHA-256 manifest checked” must only survive if the final check succeeds.
2. The outbound packet URL currently addresses the evidence branch. Verify it exists after publication and include an immutable commit link in the final issue comment or PR, so later branch changes cannot replace the cited observations.
3. Optional precision: README says the unguarded twin “changes only the application mutation guard.” Implementation replaces `RewardLedger.credit` with a plain in-memory balance increment as its negative control. “Replaces the guarded application mutation with an unguarded increment” describes the actual control more precisely. The existing claim that Socket.IO does not supply the application guard is supported.

No stale native-API, network-loss, upstream-suite, crash-durability, exactly-once or maintainer-adoption success claim was found. The evidence supports the small conclusion that identical timeout/error observations can coexist with different receiver-side effect counts in this controlled fixture. It is not a Socket.IO defect report or a production retry-safety proof.
