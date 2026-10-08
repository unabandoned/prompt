/*
 * read.test.js: terminal-mode tests for the readline-based reader.
 */

var test = require('node:test'),
    assert = require('node:assert/strict'),
    PassThrough = require('node:stream').PassThrough,
    read = require('../lib/read');

// A PassThrough that readline treats as a terminal.
function tty() {
  var s = new PassThrough();
  s.setEncoding('utf8');
  s.isTTY = true;
  s.columns = 80;
  s.rows = 24;
  return s;
}

function run(opts, keys) {
  var input = new PassThrough(),
      output = tty(),
      out = '';
  output.on('data', function (d) { out += d; });
  return new Promise(function (resolve) {
    read(Object.assign({ input: input, output: output }, opts), function (err, line, isDefault) {
      resolve({ err: err, line: line, isDefault: isDefault, out: out });
    });
    setImmediate(function () { input.write(keys); });
  });
}

test('hidden input is not echoed and honours backspace', async function () {
  var r = await run({ prompt: 'password: ', silent: true }, '12345\x7f\x7f\r');
  assert.equal(r.err, null);
  assert.equal(r.line, '123');
  assert.ok(r.out.includes('password: '));
  assert.ok(!/[0-9]/.test(r.out.replace(/\u001b\[[0-9;]*[A-Za-z]/g, '')));
});

test('hidden input with replace echoes the replacement character', async function () {
  var r = await run({ prompt: 'pw:', silent: true, replace: '*' }, 'ab\x7fcd\r');
  assert.equal(r.line, 'acd');
  assert.ok(r.out.includes('**'));
  assert.ok(!/[abcd]/.test(r.out.replace(/\u001b\[[0-9;]*[A-Za-z]/g, '').replace('pw:', '')));
});

test('an empty answer takes the default and says so', async function () {
  var r = await run({ prompt: 'name:', default: 'dd' }, '\r');
  assert.equal(r.line, 'dd');
  assert.equal(r.isDefault, true);
  assert.ok(r.out.includes('name: (dd) '));
});

test('a hidden default is not shown', async function () {
  var r = await run({ prompt: 'pw:', silent: true, default: 'secret' }, '\r');
  assert.equal(r.line, 'secret');
  assert.ok(r.out.includes('(<default hidden>)'));
  assert.ok(!r.out.includes('(secret)'));
});

test('Ctrl+C cancels the read', async function () {
  var r = await run({ prompt: 'q:' }, 'ab\x03');
  assert.equal(r.err.message, 'canceled');
});

test('rejects a non-string, non-number default', function () {
  assert.throws(function () { read({ default: {} }, function () {}); }, /default value/);
});
