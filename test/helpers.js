/*
 * helpers.js: test helpers for the prompt tests.
 *
 * (C) 2010, Nodejitsu Inc.
 *
 */

var PassThrough = require('node:stream').PassThrough,
    prompt = require('../lib/prompt');

var helpers = exports;

helpers.stdin = new PassThrough();
helpers.stdout = new PassThrough();
helpers.stdout.setEncoding('utf8');

//
// Answer each upcoming prompt with the next of `lines`, one per `prompt`
// event, so every answer reaches the readline interface that asked for it.
//
helpers.answer = function (lines) {
  lines = lines.slice();
  function next() {
    if (!lines.length) {
      prompt.removeListener('prompt', onPrompt);
      return;
    }
    helpers.stdin.write(lines.shift());
  }
  function onPrompt() {
    setImmediate(next);
  }
  prompt.on('prompt', onPrompt);
};

//
// Collect what prompt writes to its output stream, and what its logger writes
// to process.stderr (where validation errors go), while `fn` runs. stdout is
// left alone: the test runner reports through it.
//
helpers.capture = async function (fn) {
  var out = '',
      err = '',
      onData = function (d) { out += d; },
      stderrWrite = process.stderr.write;

  helpers.stdout.on('data', onData);
  process.stderr.write = function (c) { err += c; return true; };
  try {
    var result = await fn();
    return { result: result, out: out, err: err };
  } finally {
    process.stderr.write = stderrWrite;
    helpers.stdout.removeListener('data', onData);
  }
};

//
// Run `prompt.get` (or any callback-style call) as a promise.
//
helpers.call = function (fn) {
  return new Promise(function (resolve, reject) {
    fn(function (err, result) {
      return err ? reject(err) : resolve(result);
    });
  });
};

// 1) .properties
// 2) warning --> message
// 3) Name --> description || key
// 4) validator --> conform (fxns), pattern (regexp), format (built-in)
// 5) empty --> required
helpers.schema = {
  properties: {
    oldschema: {
      message: 'Enter your username',
      validator: /^[\w|-]+$/,
      warning: 'username can only be letters, numbers, and dashes',
      empty: false
    },
    riffwabbles: {
      pattern: /^[\w|-]+$/,
      message: 'riffwabbles can only be letters, numbers, and dashes',
      default: 'foobizzles'
    },
    functiondefaultpluralanimal: {
      message: 'function default plural animal',
      default: function () {
        return prompt.history('animal').value + 's';
      }
    },
    functiondefaulttest: {
      message: 'function default test',
      default: function () {
        return 'test';
      }
    },
    functiondefaultundefined: {
      message: 'function default undefined',
      default: function () { }
    },
    number: {
      type: 'number',
      message: 'pick a number, any number',
      default: 10
    },
    integer: {
      type: 'integer'
    },
    boolean: {
      type: 'boolean'
    },
    username: {
      pattern: /^[\w|-]+$/,
      message: 'Username can only be letters, numbers, and dashes'
    },
    notblank: {
      required: true
    },
    password: {
      hidden: true,
      required: true
    },
    badValidator: {
      pattern: ['cant', 'use', 'array']
    },
    animal: {
      description: 'Enter an animal',
      default: 'dog',
      pattern: /dog|cat/
    },
    sound: {
      description: 'What sound does this animal make?',
      conform: function (value) {
        var animal = prompt.history(0).value;

        return animal === 'dog' && value === 'woof'
          || animal === 'cat' && value === 'meow';
      }
    },
    fnvalidator: {
      name: 'fnvalidator',
      validator: function (line) {
        return line.slice(0,2) == 'fn';
      },
      message: 'fnvalidator must start with "fn"'
    },
    fnconform: {
      conform: function (line) {
        return line.slice(0,2) == 'fn';
      },
      message: 'fnconform must start with "fn"'
    }
  }
};
