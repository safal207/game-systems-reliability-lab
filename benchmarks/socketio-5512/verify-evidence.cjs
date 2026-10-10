'use strict';

// Listed byte integrity and bundle membership; not an authenticity verifier.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const root = __dirname;
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
assert.equal(manifest.schema, 'socketio-5512-evidence-manifest/1');
const seen = new Set();
const hash = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');

function check(base, entry) {
  const relative = entry.path;
  assert.ok(typeof relative === 'string' && relative.length && !relative.includes('\\'));
  assert.ok(!path.isAbsolute(relative) && !relative.split('/').includes('..'));
  const target = path.join(base, relative);
  assert.ok(fs.lstatSync(target).isFile() && !fs.lstatSync(target).isSymbolicLink(), `nonregular: ${relative}`);
  assert.ok(fs.realpathSync(target).startsWith(fs.realpathSync(base) + path.sep), `outside root: ${relative}`);
  const bytes = fs.readFileSync(target);
  assert.equal(bytes.length, entry.size_bytes, `size mismatch: ${relative}`);
  assert.equal(hash(bytes), entry.sha256, `sha256 mismatch: ${relative}`);
}

for (const entry of manifest.files) {
  assert.ok(!seen.has(entry.path), `duplicate: ${entry.path}`);
  seen.add(entry.path);
  check(root, entry);
}

function walk(directory, prefix = '') {
  for (const name of fs.readdirSync(directory)) {
    const relative = prefix ? `${prefix}/${name}` : name;
    if (!prefix && ['node_modules', 'artifacts', 'manifest.json'].includes(name)) continue;
    const target = path.join(directory, name);
    const stat = fs.lstatSync(target);
    assert.ok(!stat.isSymbolicLink(), `unexpected symlink: ${relative}`);
    if (stat.isDirectory()) walk(target, relative);
    else assert.ok(seen.has(relative), `unlisted file: ${relative}`);
  }
}
walk(root);

const repository = path.resolve(root, '../..');
for (const entry of manifest.repository_source_files) check(repository, entry);
console.log(`${seen.size} packet files and ${manifest.repository_source_files.length} source files match manifest; no authenticity claim.`);
