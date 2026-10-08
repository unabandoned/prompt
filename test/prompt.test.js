/*
 * prompt.test.js: Tests for prompt.
 *
 * (C) 2010, Nodejitsu Inc.
 *
 */

var test = require('node:test'),
    assert = require('node:assert/strict'),
    prompt = require('../lib/prompt'),
    helpers = require('./helpers'),
    schema = helpers.schema;

var describe = test.describe,
    it = test.it,
    afterEach = test.afterEach;

// A helper to pass fragments of our schema into prompt as full schemas.
function grab(name) {
  return { path: [name], schema: schema.properties[name] };
}

function once(event) {
  return new Promise(function (resolve) {
    prompt.once(event, function () { resolve(Array.prototype.slice.call(arguments)); });
  });
}

prompt.started = false;
prompt.start({
  stdin: helpers.stdin,
  stdout: helpers.stdout,
  noHandleSIGINT: true
});

afterEach(function () {
  prompt.override = null;
});

describe('getInput()', function () {
  it('prompts with a simple string and responds with the line', async function () {
    var r = await helpers.capture(function () {
      helpers.answer(['test value\n']);
      return helpers.call(function (cb) { prompt.getInput('test input', cb); });
    });
    assert.equal(r.result, 'test value');
    assert.ok(r.out.includes('test input'));
  });

  it('reports invalid input for an empty required field', async function () {
    var r = await helpers.capture(async function () {
      var invalid = once('invalid');
      helpers.answer(['\n', 'filled\n']);
      var done = helpers.call(function (cb) { prompt.getInput(grab('notblank'), cb); });
      var args = await invalid;
      return { args: args, value: await done };
    });
    assert.equal(typeof r.result.args[0], 'object');
    assert.equal(r.result.args[1], '');
    assert.equal(r.result.value, 'filled');
    assert.ok(r.err.includes('Invalid input'));
    assert.ok(r.out.includes('notblank'));
  });

  it('reads a hidden field without echoing it', async function () {
    var r = await helpers.capture(function () {
      helpers.answer(['trustno1\n']);
      return helpers.call(function (cb) { prompt.getInput('password', cb); });
    });
    assert.equal(r.result, 'trustno1');
    assert.ok(r.out.includes('password'));
    assert.ok(!r.out.includes('trustno1'));
  });

  it('reports invalid input for an empty hidden required field', async function () {
    var r = await helpers.capture(async function () {
      var invalid = once('invalid');
      helpers.answer(['\n', 'secret\n']);
      var done = helpers.call(function (cb) { prompt.getInput(grab('password'), cb); });
      var args = await invalid;
      await done;
      return args;
    });
    assert.equal(r.result[1], '');
    assert.ok(r.err.includes('Invalid input'));
    assert.ok(r.out.includes('password'));
  });

  it('casts an integer field', async function () {
    var r = await helpers.capture(function () {
      helpers.answer(['42\n']);
      return helpers.call(function (cb) { prompt.getInput(grab('integer'), cb); });
    });
    assert.equal(r.result, 42);
    assert.ok(r.out.includes('integer'));
  });

  it('re-prompts when an integer field gets a non-integer', async function () {
    var r = await helpers.capture(function () {
      helpers.answer(['4.2\n', '42\n']);
      return helpers.call(function (cb) { prompt.getInput(grab('integer'), cb); });
    });
    assert.equal(r.result, 42);
    assert.ok(r.err.includes('Invalid input'));
  });

  it('casts a boolean field', async function () {
    var r = await helpers.capture(function () {
      helpers.answer(['true\n']);
      return helpers.call(function (cb) { prompt.getInput(grab('boolean'), cb); });
    });
    assert.equal(r.result, true);
    assert.ok(r.out.includes('boolean'));
  });

  it('re-prompts when a boolean field gets a non-boolean', async function () {
    var r = await helpers.capture(function () {
      helpers.answer(['4.2\n', 'F\n']);
      return helpers.call(function (cb) { prompt.getInput(grab('boolean'), cb); });
    });
    assert.equal(r.result, false);
    assert.ok(r.err.includes('Invalid input'));
  });

  it('accepts input matching a pattern', async function () {
    var r = await helpers.capture(function () {
      helpers.answer(['some-user\n']);
      return helpers.call(function (cb) { prompt.getInput(grab('username'), cb); });
    });
    assert.equal(r.result, 'some-user');
    assert.ok(r.out.includes('username'));
  });

  it('logs the schema message when input misses the pattern', async function () {
    var r = await helpers.capture(function () {
      helpers.answer(['some -user\n', 'some-user\n']);
      return helpers.call(function (cb) { prompt.getInput(grab('username'), cb); });
    });
    assert.equal(r.result, 'some-user');
    assert.ok(r.err.includes('Username can only be letters, numbers, and dashes'));
  });

  it('responds with an error for an invalid validator (array)', async function () {
    var err = await new Promise(function (resolve) {
      var called = false;
      helpers.answer(['some-user\n']);
      prompt.getInput(grab('badValidator'), function (e) {
        if (!called) {
          called = true;
          resolve(e);
        }
      });
    });
    assert.ok(err);
  });
});

describe('get()', function () {
  it('prompts for a string that is not in prompt.properties', async function () {
    var r = await helpers.capture(function () {
      helpers.answer(['test value\n']);
      return helpers.call(function (cb) { prompt.get('test input', cb); });
    });
    assert.deepEqual(r.result, { 'test input': 'test value' });
    assert.ok(r.out.includes('test input'));
  });

  it('uses a string literal default', async function () {
    prompt.properties.riffwabbles = schema.properties.riffwabbles;
    var r = await helpers.capture(function () {
      helpers.answer(['\n']);
      return helpers.call(function (cb) { prompt.get('riffwabbles', cb); });
    });
    assert.ok(r.out.includes('riffwabbles'));
    assert.ok(r.out.includes('(foobizzles)'));
    assert.equal(r.result.riffwabbles, 'foobizzles');
  });

  it('uses a function default', async function () {
    prompt.properties.functiondefaulttest = schema.properties.functiondefaulttest;
    var r = await helpers.capture(function () {
      helpers.answer(['\n']);
      return helpers.call(function (cb) { prompt.get('functionDefaultTest', cb); });
    });
    assert.ok(r.out.includes('function default test'));
    assert.ok(r.out.includes('(test)'));
    assert.strictEqual(r.result.functionDefaultTest, 'test');
  });

  it('evaluates a function default after earlier answers', async function () {
    prompt.properties.animal = schema.properties.animal;
    prompt.properties.functiondefaultpluralanimal = schema.properties.functiondefaultpluralanimal;
    var r = await helpers.capture(function () {
      helpers.answer(['cat\n', '\n']);
      return helpers.call(function (cb) {
        prompt.get(['animal', 'functiondefaultpluralanimal'], cb);
      });
    });
    assert.ok(r.out.includes('function default plural animal'));
    assert.ok(r.out.includes('(cats)'));
    assert.deepEqual(r.result, { animal: 'cat', functiondefaultpluralanimal: 'cats' });
  });

  it('prompts without a default when a function default returns undefined', async function () {
    prompt.properties.functiondefaultundefined = schema.properties.functiondefaultundefined;
    var r = await helpers.capture(function () {
      helpers.answer(['\n']);
      return helpers.call(function (cb) { prompt.get('functionDefaultUndefined', cb); });
    });
    assert.ok(r.out.includes('function default undefined'));
    assert.ok(!r.out.includes('('));
    assert.strictEqual(r.result.functionDefaultUndefined, '');
  });

  it('responds with a number for a numeric property', async function () {
    prompt.properties.number = schema.properties.number;
    var r = await helpers.capture(function () {
      helpers.answer(['15\n']);
      return helpers.call(function (cb) { prompt.get('number', cb); });
    });
    assert.strictEqual(r.result.number, 15);
  });

  it('accepts a value passing a sync .validator', async function () {
    helpers.answer(['fn123\n']);
    var result = await helpers.call(function (cb) {
      prompt.get(schema.properties.fnvalidator, cb);
    });
    assert.equal(result.fnvalidator, 'fn123');
  });

  it('accepts a value passing a sync .conform', async function () {
    helpers.answer(['fn123\n']);
    var result = await helpers.call(function (cb) { prompt.get(grab('fnconform'), cb); });
    assert.equal(result.fnconform, 'fn123');
  });

  it('applies .before to the input', async function () {
    helpers.answer(['fn456\n']);
    var result = await helpers.call(function (cb) {
      prompt.get({ properties: { fnbefore: { before: function (v) { return 'v' + v; } } } }, cb);
    });
    assert.equal(result.fnbefore, 'vfn456');
  });

  it('skips the prompt for prompt.override, including falsy values', async function () {
    prompt.override = { coconihet: 'whatever' };
    assert.deepEqual(
      await helpers.call(function (cb) { prompt.get('coconihet', cb); }),
      { coconihet: 'whatever' }
    );
    prompt.override = { coconihet: false };
    assert.deepEqual(
      await helpers.call(function (cb) { prompt.get('coconihet', cb); }),
      { coconihet: false }
    );
  });

  it('responds with several overrides', async function () {
    prompt.override = { xyz: 468, abc: 123 };
    var result = await helpers.call(function (cb) { prompt.get(['xyz', 'abc'], cb); });
    assert.deepEqual(result, { xyz: 468, abc: 123 });
  });

  it('returns a Promise without a callback', async function () {
    prompt.override = { xyz: 468, abc: 123 };
    assert.deepEqual(await prompt.get(['xyz', 'abc']), { xyz: 468, abc: 123 });
  });

  it('applies overrides to described properties', async function () {
    prompt.override = { UVW: 5423, DEF: 64235 };
    var result = await helpers.call(function (cb) {
      prompt.get({
        properties: {
          UVW: { description: 'a custom message', default: 6 },
          DEF: { description: 'a custom message', default: 6 }
        }
      }, cb);
    });
    assert.deepEqual(result, { UVW: 5423, DEF: 64235 });
  });

  it('supports the old schema format', async function () {
    prompt.properties.username = schema.properties.oldschema;
    var r = await helpers.capture(function () {
      helpers.answer(['\n', 'hell$\n', 'hello\n']);
      return helpers.call(function (cb) { prompt.get('username', cb); });
    });
    assert.ok(r.out.includes('username'));
    assert.equal(r.result.username, 'hello');
  });

  it('prompts with a type and description', async function () {
    var r = await helpers.capture(function () {
      helpers.answer(['42\n']);
      return helpers.call(function (cb) {
        prompt.get({ name: 'test', type: 'number', description: 'Please input a number' }, cb);
      });
    });
    assert.deepEqual(r.result, { test: 42 });
    assert.ok(r.out.includes('Please input a number'));
  });

  it('assembles nested properties', async function () {
    helpers.answer(['1\n', '2\n']);
    var result = await helpers.call(function (cb) {
      prompt.get({ properties: { a: { properties: { b: {}, c: {} } } } }, cb);
    });
    assert.deepEqual(result, { a: { b: '1', c: '2' } });
  });

  it('collects an array property up to maxItems', async function () {
    helpers.answer(['x\n', 'y\n']);
    var result = await helpers.call(function (cb) {
      prompt.get({ properties: { arr: { type: 'array', maxItems: 2 } } }, cb);
    });
    assert.deepEqual(result, { arr: ['x', 'y'] });
  });

  it('skips a property whose ask() returns false', async function () {
    var result = await helpers.call(function (cb) {
      prompt.get({ properties: { s: { ask: function () { return false; }, default: 'skipped' } } }, cb);
    });
    assert.deepEqual(result, { s: 'skipped' });
  });

  // The way TheTechNetwork/CyberChef's newOperation.mjs drives prompt.
  it('handles a CyberChef-style schema with an empty message', async function () {
    prompt.message = '';
    prompt.delimiter = ':';
    try {
      var r = await helpers.capture(function () {
        helpers.answer(['Bad$Name\n', 'To Upper\n', '\n', 'nope\n', 'true\n']);
        return helpers.call(function (cb) {
          prompt.get({
            properties: {
              opName: {
                description: '\nThe operation name.\nExample: URL Decode\nOperation name',
                type: 'string',
                pattern: /^[\w\s-/().]+$/,
                required: true,
                message: 'Operation names should consist of letters'
              },
              module: {
                description: '\nModule\nExample: Crypto\nModule',
                type: 'string',
                pattern: /^[A-Z][A-Za-z\d]+$/,
                default: 'Default'
              },
              highlight: {
                description: '\nEnable highlighting',
                type: 'boolean',
                default: 'false',
                message: 'Enter true or false'
              }
            }
          }, cb);
        });
      });
      assert.deepEqual(r.result, { opName: 'To Upper', module: 'Default', highlight: true });
      assert.ok(r.err.includes('Operation names should consist of letters'));
      assert.ok(r.err.includes('Enter true or false'));
      assert.ok(r.out.includes('(Default)'));
      assert.ok(!r.out.includes('prompt'));
    } finally {
      prompt.message = 'prompt';
      prompt.delimiter = ': ';
    }
  });
});

describe('addProperties()', function () {
  it('adds the prompted properties to the object', async function () {
    helpers.answer(['foo\n', 'bar\n']);
    var obj = await helpers.call(function (cb) { prompt.addProperties({}, ['foo', 'bar'], cb); });
    assert.deepEqual(obj, { foo: 'foo', bar: 'bar' });
  });

  it('returns the object as-is when no properties are missing', async function () {
    var obj = await helpers.call(function (cb) {
      prompt.addProperties({ foo: 'foo', bar: 'bar' }, [], cb);
    });
    assert.deepEqual(obj, { foo: 'foo', bar: 'bar' });
  });
});

describe('history()', function () {
  it('remembers values entered inside a complex property', async function () {
    helpers.answer(['dog\n', 'woof\n']);
    var result = await helpers.call(function (cb) {
      prompt.get([grab('animal'), grab('sound')], cb);
    });
    assert.deepEqual(result, { animal: 'dog', sound: 'woof' });
    assert.equal(prompt.history('nothing'), null);
    assert.deepEqual(prompt.history('animal'), { property: 'animal', value: 'dog' });
  });

  it('emits invalid for a value that does not conform', async function () {
    await helpers.capture(async function () {
      var invalid = once('invalid');
      helpers.answer(['dog\n', 'meow\n', 'woof\n']);
      var done = helpers.call(function (cb) { prompt.get([grab('animal'), grab('sound')], cb); });
      var args = await invalid;
      assert.equal(args[0].path.join(''), 'sound');
      assert.equal(args[1], 'meow');
      await done;
    });
  });
});

describe('confirm()', function () {
  var cases = [
    ['a string message', 'test', ['Y\n'], undefined, true],
    ['an empty answer and default yes', 'test', ['\n'], { default: 'yes' }, true],
    ['a string message', 'test', ['N\n'], undefined, false],
    ['a string message', 'test', ['YES\n'], undefined, true],
    ['a string message', 'test', ['NO\n'], undefined, false],
    ['a string message', 'test', ['T\n'], undefined, true],
    ['a string message', 'test', ['F\n'], undefined, false],
    ['a string message', 'test', ['TRUE\n'], undefined, true],
    ['a string message', 'test', ['FALSE\n'], undefined, false],
    ['an object with a description', { description: 'a custom message' }, ['Y\n'], undefined, true],
    ['custom validators', { description: 'node or jitsu?', pattern: /^(node|jitsu)/i, yes: /^node/i }, ['node\n'], undefined, true],
    ['custom validators', { description: 'node or jitsu?', pattern: /^(node|jitsu)/i, yes: /^node/i }, ['jitsu\n'], undefined, false],
    ['multiple strings', ['test', 'test2', 'test3'], ['Y\n', 'y\n', 'YES\n'], undefined, true],
    ['multiple strings', ['test', 'test2', 'test3'], ['Y\n', 'N\n', 'YES\n'], undefined, false],
    ['multiple strings', ['test', 'test2', 'test3'], ['n\n', 'NO\n', 'N\n'], undefined, false],
    ['multiple objects', [{ message: 'test' }, { message: 'test2' }], ['y\n', 'y\n'], undefined, true],
    ['multiple objects', [{ message: 'test' }, { message: 'test2' }], ['n\n', 'n\n'], undefined, false],
    ['multiple objects', [{ message: 'test' }, { message: 'test2' }], ['n\n', 'y\n'], undefined, false]
  ];

  cases.forEach(function (c) {
    it('with ' + c[0] + ', answering ' + c[2].join('').replace(/\n/g, ' ').trim() + ' -> ' + c[4], async function () {
      helpers.answer(c[2]);
      var result = await helpers.call(function (cb) {
        if (c[3]) prompt.confirm(c[1], c[3], cb);
        else prompt.confirm(c[1], cb);
      });
      assert.strictEqual(result, c[4]);
    });
  });
});

describe('side effects', function () {
  it('does not extend String.prototype', function () {
    assert.equal(''.yellow, undefined);
    assert.equal(''.green, undefined);
  });

  it('does not patch readline.Interface', function () {
    var readline = require('node:readline');
    assert.ok(!/_promptLength/.test(readline.Interface.prototype.setPrompt.toString()));
  });
});
