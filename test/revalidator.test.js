/*
 * revalidator.test.js: the vendored validator's email/url formats.
 */

var test = require('node:test'),
    assert = require('node:assert/strict'),
    validate = require('../lib/revalidator').validate;

function check(format, value) {
  return validate({ v: value }, { properties: { v: { type: 'string', format: format } } }).valid;
}

test('email format accepts and rejects as before', function () {
  assert.ok(check('email', 'first.last+tag@sub.example.co.uk'));
  assert.ok(!check('email', 'a@b..com'));
  assert.ok(!check('email', 'a@-b.com'));
});

test('url format accepts and rejects as before', function () {
  assert.ok(check('url', 'https://sub.example.co.uk:8080/p/a.th?q=1#f'));
  assert.ok(check('url', 'ftp://user:pw@1.2.3.4/x'));
  assert.ok(!check('url', 'http://a..b'));
});

test('email and url formats do not backtrack exponentially', function () {
  var start = Date.now();
  check('email', 'a@a' + '0.0'.repeat(40) + '!');
  check('url', 'ftp://a' + '0.0'.repeat(40) + '!');
  assert.ok(Date.now() - start < 1000);
});
