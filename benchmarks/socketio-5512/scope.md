# Preregistered acknowledgement/effect boundary

Target discussion: socketio/socket.io#5512. Source inspected at 1eaa582d3b453e3e6f522300ed05b10da0a0799b. Runtime subjects: published socket.io and socket.io-client 4.8.4, Zod 4.6.5. The proposed native contract API is not implemented in these subjects; this fixture uses an explicitly userland synchronous Standard Schema helper, with a fixture-only wire envelope.

Six scenarios, each with callback and emitWithAck: successful ACK; request rejected before handler; invalid response after effect; no effect and no ACK; effect and no ACK; effect followed by server disconnect. A client transport error or invalid response does not establish effect count. Two timeout worlds must show the same client error with independently measured effect counts zero and one.

Two application retry controls per API: same business action ID after a lost ACK with the existing application RewardLedger gives one effect; deliberately unguarded application retry gives two. This is not a Socket.IO dedupe guarantee. All economic values are synthetic; balances and dedupe live in one process's memory.

Each scenario constructs a fresh localhost HTTP/Socket.IO server and client. Receiver-side barriers record the controlled branch before conclusions; disconnect is caused only after the effect is observed locally, never inferred from a timed sleep. No providers, production services, secrets, fuzzing, load tests, process crash, persistence, external settlement or distributed exactly-once claim. Server/client close after each case. Current user Go continues the selected OSS validation and addressable follow-up; no merge/deploy authority.

Expected assertions use literal counts and actual ledger balance transitions, rather than deriving expectations from the ACK or validator result. Existing upstream transport timeout/disconnect/retry tests are acknowledged; new coverage is the paired effect counts and validation stage. AI-assisted implementation/review by safal207; RFC credit GermanJablo and maintainer discussion darrachequesne.
