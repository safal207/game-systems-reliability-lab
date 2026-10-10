'use strict';

// Native Socket.IO transport; explicit USERLAND validation, not the RFC API.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { Server } = require('socket.io');
const { io: connect } = require('socket.io-client');
const { z } = require('zod');
const { RewardLedger } = require('../../src/reward-ledger');

const ACK_TIMEOUT_MS = 500;
const PLAYER = 'synthetic-player';
const REQUEST = { actionId: 'stable-business-action', claimType: 'round-win' };
const requestSchema = z.object({ actionId: z.string().min(1), claimType: z.literal('round-win') });
const responseSchema = z.object({
  actionId: z.string(), applied: z.boolean(), duplicate: z.boolean(),
  balanceAfter: z.number().int().nonnegative(),
});

function validate(schema, value) {
  const result = schema['~standard'].validate(value);
  if (result && typeof result.then === 'function') {
    throw new Error('HARNESS_ERROR: async Standard Schema is outside this synchronous fixture');
  }
  return result;
}

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

async function bounded(promise, label) {
  let timer;
  try {
    return await Promise.race([promise, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`HARNESS_ERROR: ${label} watchdog`)), 5000);
    })]);
  } finally {
    clearTimeout(timer);
  }
}

function transportCode(error) {
  if (error.message === 'operation has timed out') return 'TIMEOUT';
  if (error.message === 'socket has been disconnected') return 'DISCONNECTED';
  return 'UNEXPECTED_TRANSPORT_ERROR';
}

function decode(raw) {
  if (raw.transport_error) {
    return { code: transportCode(raw.transport_error), knowledge: 'UNKNOWN', data: null };
  }
  const reply = raw.raw_ack_payload;
  if (!reply || typeof reply !== 'object') throw new Error('HARNESS_ERROR: missing fixture envelope');
  if (reply.error) {
    return {
      code: reply.error.code,
      knowledge: reply.error.code === 'REQUEST_VALIDATION_ERROR' ? 'NO_SELECTED_HANDLER_EFFECT' : 'UNKNOWN',
      data: null,
    };
  }
  const parsed = validate(responseSchema, reply.data);
  if (parsed.issues) return { code: 'RESPONSE_VALIDATION_ERROR', knowledge: 'UNKNOWN', data: null };
  return { code: 'OK', knowledge: 'ACK_RECEIVED_AND_VALIDATED', data: parsed.value };
}

async function send(socket, api, request, record, attempt) {
  record('client_send', { attempt, request });
  let raw;
  if (api === 'callback') {
    raw = await new Promise((resolve) => {
      socket.timeout(ACK_TIMEOUT_MS).emit('reward:claim', request, (error, reply) => {
        resolve({ transport_error: error || null, raw_ack_payload: reply ?? null });
      });
    });
  } else {
    try {
      const reply = await socket.timeout(ACK_TIMEOUT_MS).emitWithAck('reward:claim', request);
      raw = { transport_error: null, raw_ack_payload: reply ?? null };
    } catch (error) {
      raw = { transport_error: error, raw_ack_payload: null };
    }
  }
  const outcome = decode(raw);
  const observation = {
    transport_error: raw.transport_error ? {
      name: raw.transport_error.name, message: raw.transport_error.message,
    } : null,
    raw_ack_payload: raw.raw_ack_payload,
    userland_result: outcome,
  };
  record('client_settled', { attempt, code: outcome.code });
  return observation;
}

async function runCase(api, scenario, guarded = true) {
  const trace = [];
  const effects = [];
  const ledger = new RewardLedger();
  const receiverSeen = deferred();
  const clients = [];
  let ingressCalls = 0;
  let handlerCalls = 0;
  let unguardedBalance = 0;
  const record = (event, data = {}) => trace.push({
    sequence: trace.length + 1, observed_at: new Date().toISOString(), event, ...data,
  });
  const balance = () => guarded ? ledger.getBalance(PLAYER) : unguardedBalance;
  const server = http.createServer();
  const io = new Server(server, { serveClient: false });
  io.on('connection', (socket) => {
    socket.on('reward:claim', (payload, ack) => {
      ingressCalls++;
      record('request_received', { ingress: ingressCalls, payload });
      const parsed = validate(requestSchema, payload);
      if (parsed.issues) {
        record('request_rejected_before_business_handler');
        receiverSeen.resolve();
        ack({ error: { code: 'REQUEST_VALIDATION_ERROR' }, data: null });
        return;
      }
      handlerCalls++;
      record('business_handler_entered', { handler_call: handlerCalls });
      if (scenario === 'timeout-no-effect') {
        record('ack_deliberately_withheld', { effect_applied: false });
        receiverSeen.resolve();
        return;
      }
      const before = balance();
      const receipt = guarded ? ledger.credit({ playerId: PLAYER, actionId: parsed.value.actionId, amount: 10 }) : {
        actionId: parsed.value.actionId, playerId: PLAYER, amount: 10,
        applied: true, duplicate: false, balanceAfter: (unguardedBalance += 10),
      };
      const after = balance();
      // Effect oracle uses actual balance change, not receipt.applied or ACK validity.
      if (after !== before) {
        assert.equal(after - before, 10);
        effects.push({ actionId: parsed.value.actionId, playerId: PLAYER, amount: after - before });
        record('effect_applied', { ordinal: effects.length, balance_before: before, balance_after: after });
      } else {
        record('application_deduplicated', { balance_after: after });
      }
      receiverSeen.resolve();
      if (scenario === 'timeout-after-effect' || (scenario === 'retry' && handlerCalls === 1)) {
        record('ack_deliberately_withheld', { effect_applied: true });
        return;
      }
      if (scenario === 'disconnect-after-effect') {
        record('server_initiated_disconnect_after_effect');
        socket.disconnect(true);
        return;
      }
      const data = scenario === 'invalid-response' ? { ...receipt, balanceAfter: 'ten' } : receipt;
      record('server_ack_sent', { response_valid_in_fixture: scenario !== 'invalid-response' });
      // Fixture envelope only; this does not choose an RFC tuple/Node-style API.
      ack({ error: null, data });
    });
  });

  async function openClient() {
    const socket = connect(`http://127.0.0.1:${server.address().port}`, {
      transports: ['websocket'], forceNew: true, autoConnect: false,
      reconnection: false, retries: 0, timeout: 2000,
    });
    clients.push(socket);
    const connected = new Promise((resolve, reject) => {
      socket.once('connect', resolve);
      socket.once('connect_error', reject);
    });
    socket.connect();
    await bounded(connected, 'connect');
    return socket;
  }

  try {
    await bounded(new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    }), 'listen');
    const client = await openClient();
    const request = scenario === 'invalid-request' ? { ...REQUEST, actionId: 42 } : { ...REQUEST };
    const sending = send(client, api, request, record, 1);
    await bounded(receiverSeen.promise, 'receiver branch');
    const first = await bounded(sending, 'first result');
    const firstEffectCount = effects.length;
    const firstBalance = balance();
    let retry = null;
    if (scenario === 'retry') {
      assert.equal(first.userland_result.code, 'TIMEOUT');
      assert.equal(firstEffectCount, 1);
      assert.equal(firstBalance, 10);
      client.disconnect();
      record('explicit_client_reconstruction_before_same_id_retry');
      const secondClient = await openClient();
      retry = await bounded(send(secondClient, api, { ...REQUEST }, record, 2), 'retry result');
    }
    const row = {
      case: `${api}/${scenario}${scenario === 'retry' ? (guarded ? '/guarded' : '/unguarded-negative') : ''}`,
      api, scenario, application_guarded: guarded, ingress_calls: ingressCalls,
      business_handler_calls: handlerCalls, first, retry, first_effect_count: firstEffectCount,
      first_balance: firstBalance, effect_count: effects.length, balance: balance(), effects, trace,
    };
    const wanted = {
      success: ['OK', 1, 1],
      'invalid-request': ['REQUEST_VALIDATION_ERROR', 0, 0],
      'invalid-response': ['RESPONSE_VALIDATION_ERROR', 1, 1],
      'timeout-no-effect': ['TIMEOUT', 0, 1],
      'timeout-after-effect': ['TIMEOUT', 1, 1],
      'disconnect-after-effect': ['DISCONNECTED', 1, 1],
      retry: ['TIMEOUT', guarded ? 1 : 2, 2],
    }[scenario];
    assert.equal(first.userland_result.code, wanted[0]);
    assert.equal(row.effect_count, wanted[1]);
    assert.equal(row.balance, wanted[1] * 10);
    assert.equal(handlerCalls, wanted[2]);
    assert.equal(ingressCalls, scenario === 'retry' ? 2 : 1);
    const effectPosition = trace.findIndex((e) => e.event === 'effect_applied');
    const firstSettlement = trace.findIndex((e) => e.event === 'client_settled' && e.attempt === 1);
    if (firstEffectCount) assert.ok(effectPosition >= 0 && effectPosition < firstSettlement, 'effect must precede client settlement');
    if (['invalid-request', 'invalid-response'].includes(scenario)) {
      assert.equal(first.transport_error, null, 'schema errors are userland results after native transport success');
      assert.ok(first.raw_ack_payload);
    }
    if (scenario === 'retry') {
      assert.equal(retry.userland_result.code, 'OK');
      assert.equal(retry.userland_result.data.duplicate, guarded);
      const sends = trace.filter((e) => e.event === 'client_send');
      assert.deepEqual(sends[0].request, sends[1].request, 'retry must preserve the same business identity and payload');
    }
    row.expected = { first_code: wanted[0], effect_count: wanted[1], balance: wanted[1] * 10, business_handler_calls: wanted[2] };
    row.assertions = 'PASS_WITHIN_BOUND';
    return row;
  } finally {
    for (const socket of clients) socket.disconnect();
    await new Promise((resolve) => io.close(resolve));
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length !== 2 || args[0] !== '--output') throw new Error('Usage: node run-matrix.cjs --output NEW-FILE.json');
  const output = path.resolve(args[1]);
  if (fs.existsSync(output)) throw new Error('Evidence output already exists; preserve the earlier attempt');
  const rows = [];
  for (const api of ['callback', 'promise']) {
    for (const scenario of ['success', 'invalid-request', 'invalid-response', 'timeout-no-effect', 'timeout-after-effect', 'disconnect-after-effect']) {
      rows.push(await runCase(api, scenario));
    }
    rows.push(await runCase(api, 'retry', true));
    rows.push(await runCase(api, 'retry', false));
    const zero = rows.find((r) => r.api === api && r.scenario === 'timeout-no-effect');
    const one = rows.find((r) => r.api === api && r.scenario === 'timeout-after-effect');
    assert.deepEqual(zero.first.transport_error, one.first.transport_error, 'paired timeout worlds must expose identical raw native errors');
    assert.deepEqual(zero.first.userland_result, one.first.userland_result, 'client outcome must not leak out-of-band effect knowledge');
  }
  const digest = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  const result = {
    schema: 'socketio-5512-native-transport-userland-validation/1',
    attempt_id: crypto.randomUUID(), collected_at: new Date().toISOString(),
    node: process.version, platform: process.platform, architecture: process.arch,
    packages: Object.fromEntries(['socket.io', 'socket.io-client', 'zod'].map((name) => [name, require(`${name}/package.json`).version])),
    runner_sha256: digest(__filename), ledger_sha256: digest(require.resolve('../../src/reward-ledger')),
    native_client_runtime_sha256: digest(require.resolve('socket.io-client')),
    ack_timeout_ms: ACK_TIMEOUT_MS, native_retries: 0, auto_reconnection: false,
    validation_location: 'explicit userland Standard Schema request helper and client response decoder',
    source_review_sha: '1eaa582d3b453e3e6f522300ed05b10da0a0799b',
    source_review_execution: 'NOT_RUN; runtime uses published packages',
    cases: rows, pass_count: rows.length, fail_count: 0,
  };
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
  for (const row of rows) console.log(`${row.case}: ${row.assertions} effects=${row.effect_count} first=${row.first.userland_result.code}`);
  console.log(`16 bounded assertions passed; original timeout/validation states remain errors.`);
}

main().catch((error) => {
  console.error(error.stack);
  process.exitCode = 1;
});
