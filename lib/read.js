/*
 * read.js: read one line from a stream, built on node:readline.
 *
 * Replaces the `read@1` package (and its `mute-stream` dependency) with the
 * same behaviour prompt relied on: a trimmed prompt, an optional default shown
 * as `(default)`, hidden input that can echo a replacement character, and a
 * `canceled` error on Ctrl+C.
 */

var EventEmitter = require('node:events'),
    readline = require('node:readline');

//
// ### function Mute (dest, options)
// Output proxy handed to readline. While muted it swallows what readline
// echoes, or replaces each character with `options.replace`, leaving a
// redrawn prompt intact.
//
function Mute(dest, options) {
  EventEmitter.call(this);
  this.dest = dest;
  this.muted = false;
  this.replace = options.replace;
  this._prompt = options.prompt || null;
  this._hadControl = false;
}

Mute.prototype = Object.create(EventEmitter.prototype);
Mute.prototype.constructor = Mute;

['isTTY', 'columns', 'rows'].forEach(function (key) {
  Object.defineProperty(Mute.prototype, key, {
    get: function () { return this.dest[key]; },
    enumerable: true,
    configurable: true
  });
});

Mute.prototype.mute = function () { this.muted = true; };
Mute.prototype.unmute = function () { this.muted = false; };

Mute.prototype.write = function (c) {
  c = String(c);
  if (this.muted) {
    if (!this.replace) return true;
    if (/^\u001b/.test(c)) {
      if (this._prompt && c.indexOf(this._prompt) === 0) {
        c = this._prompt + c.slice(this._prompt.length).replace(/./g, this.replace);
      }
      this._hadControl = true;
    } else {
      var head = '';
      if (this._prompt && this._hadControl && c.indexOf(this._prompt) === 0) {
        this._hadControl = false;
        head = this._prompt;
        c = c.slice(this._prompt.length);
      }
      c = head + c.replace(/./g, this.replace);
    }
  }
  return this.dest.write(c);
};

Mute.prototype.end = function () {};

//
// ### function read (opts, callback)
// #### @opts {Object} prompt, default, silent, replace, input, output, terminal
// #### @callback {function} Called with (err, line, isDefault).
//
module.exports = function read(opts, callback) {
  if (typeof opts.default !== 'undefined' &&
      typeof opts.default !== 'string' &&
      typeof opts.default !== 'number') {
    throw new Error('default value must be string or number');
  }

  var input = opts.input || process.stdin,
      dest = opts.output || process.stdout,
      promptText = (opts.prompt || '').trim() + ' ',
      silent = opts.silent,
      def = opts.default || '',
      called = false;

  if (def) {
    promptText += silent ? '(<default hidden>) ' : '(' + def + ') ';
  }

  var terminal = !!(opts.terminal || dest.isTTY),
      output = new Mute(dest, { replace: opts.replace, prompt: promptText }),
      rl = readline.createInterface({ input: input, output: output, terminal: terminal });

  rl.setPrompt(promptText);
  rl.prompt();
  if (silent) {
    output.mute();
  }

  function done() {
    called = true;
    rl.close();
    output.mute();
  }

  function onError(err) {
    if (called) return;
    done();
    callback(err);
  }

  rl.on('line', function (line) {
    if (called) return;
    if (silent && terminal) {
      output.unmute();
      output.write('\r\n');
    }
    done();
    line = line.replace(/\r?\n$/, '');
    var isDefault = false;
    if (def && !line) {
      isDefault = true;
      line = def;
    }
    callback(null, line, isDefault);
  });

  rl.on('error', onError);
  rl.on('SIGINT', function () {
    rl.close();
    onError(new Error('canceled'));
  });
};
