/*
 * logger.test.js: tests for prompt's CLI logger and colour helper.
 */

var test = require('node:test'),
    assert = require('node:assert/strict'),
    logger = require('../lib/logger');

function capture(fn) {
  var out = '', err = '',
      ow = process.stdout.write, ew = process.stderr.write;
  process.stdout.write = function (c) { out += c; return true; };
  process.stderr.write = function (c) { err += c; return true; };
  try { fn(); } finally {
    process.stdout.write = ow;
    process.stderr.write = ew;
  }
  return { out: out, err: err };
}

function withEnv(name, value, fn) {
  var had = name in process.env, old = process.env[name];
  if (value === undefined) delete process.env[name]; else process.env[name] = value;
  try { return fn(); } finally {
    if (had) process.env[name] = old; else delete process.env[name];
  }
}

test('writes padded CLI levels, errors to stderr and the rest to stdout', function () {
  var log = logger.createLogger();
  var r = withEnv('FORCE_COLOR', '0', function () {
    return capture(function () {
      log.error('bad %s', 'thing');
      log.warn('careful');
      log.help('a hint');
      log.info('note', { a: 1, b: 'x' });
      log.input('hidden below info');
      log.debug('hidden below info');
    });
  });
  assert.equal(r.err, 'error:   bad thing\n');
  assert.equal(r.out, 'warn:    careful\nhelp:    a hint\ninfo:    note a=1, b=x\n');
});

test('lowering the level shows more', function () {
  var log = logger.createLogger();
  log.level = 'silly';
  var r = withEnv('FORCE_COLOR', '0', function () {
    return capture(function () { log.input('typed'); log.debug('dbg'); });
  });
  assert.equal(r.out, 'input:   typed\n');
  assert.equal(r.err, 'debug:   dbg\n');
});

test('colours level labels the way winston did', function () {
  var log = logger.createLogger();
  var r = withEnv('FORCE_COLOR', undefined, function () {
    return capture(function () { log.error('x'); });
  });
  assert.equal(r.err, '\u001b[31merror\u001b[39m:   x\n');
});

test('colour wraps each line and is disabled by FORCE_COLOR=0', function () {
  withEnv('FORCE_COLOR', undefined, function () {
    assert.equal(logger.color('grey', 'a\nb'), '\u001b[90ma\u001b[39m\n\u001b[90mb\u001b[39m');
    assert.equal(logger.color('grey', ''), '');
  });
  withEnv('FORCE_COLOR', '0', function () {
    assert.equal(logger.color('grey', 'a'), 'a');
  });
});
