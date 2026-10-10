@GermanJablo @darrachequesne, I ran a small userland Standard Schema example over real Socket.IO 4.8.4 transport to complement the proposed acknowledgement error union.

The callback and `emitWithAck` matrix retains receiver-side balance/effect observations separately from the client result:

| Controlled case | Effect count | Client result |
|---|---:|---|
| Request rejected before the business handler | 0 | Userland request-validation error |
| Effect applied, response fails validation | 1 | Userland response-validation error |
| ACK withheld, handler skips mutation | 0 | Native timeout |
| ACK withheld after mutation | 1 | The **same** native timeout |
| Server disconnects after mutation | 1 | Native disconnect error |

The paired timeout cases assert identical raw Error name/message. A separate same-ID reconnect/retry control gives one effect with the application's existing `RewardLedger`, and two with a deliberately unguarded balance increment. The mutation guard belongs to the application.

[Runnable packet, exact observations and lockfile](https://github.com/safal207/game-systems-reliability-lab/tree/evidence/socketio-5512-20261011/benchmarks/socketio-5512). Two fresh-process attempts pass all 16 cases, including the unsafe retry negative control.

This does not implement the native `contract` API: validation is explicit userland Zod `~standard`, and schema errors are separate from successful transport ACKs. ACKs are deliberately withheld, not measured packet loss; effects/dedupe are process-memory synthetic data.

Would these effect-count twins be useful alongside Socket.IO's existing transport tests, so RESPONSE_VALIDATION_ERROR / TIMEOUT_ERROR / DISCONNECTED_ERROR do not imply non-execution or permission to retry with a new action ID?

AI-assisted implementation and review; no Socket.IO runtime patch or delivery-guarantee claim.
