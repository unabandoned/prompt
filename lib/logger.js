/*
 * logger.js: the small CLI logger prompt exposes as `prompt.logger`.
 *
 * Replaces the winston@2 logger prompt used to configure with `logger.cli()`:
 * the same CLI levels, padded and coloured level labels, `info` as the default
 * threshold, and `error`/`debug` written to stderr, everything else to stdout.
 */

var util = require('node:util');

var CODES = {
  red: [31, 39],
  yellow: [33, 39],
  green: [32, 39],
  blue: [34, 39],
  magenta: [35, 39],
  cyan: [36, 39],
  grey: [90, 39]
};

function hasFlag(flag) {
  var argv = process.argv,
      terminator = argv.indexOf('--'),
      pos = argv.indexOf('--' + flag);
  return pos !== -1 && (terminator === -1 || pos < terminator);
}

//
// ### function colorEnabled ()
// Same rule prompt's previous colour library applied: colour is on unless
// turned off with --no-color, --no-colors, --color=false or FORCE_COLOR=0.
//
function colorEnabled() {
  var force = process.env.FORCE_COLOR;
  if (force !== undefined) {
    return force.length === 0 || parseInt(force, 10) !== 0;
  }
  return !(hasFlag('no-color') || hasFlag('no-colors') || hasFlag('color=false'));
}

//
// ### function color (name, text)
// Wraps `text` in the ANSI codes for `name`, re-opening the colour after any
// nested close code and around line breaks so each line stays coloured.
//
function color(name, text) {
  text = String(text);
  if (!text || !colorEnabled()) return text;
  var open = '\u001b[' + CODES[name][0] + 'm',
      close = '\u001b[' + CODES[name][1] + 'm';
  text = open + text.split(close).join(open) + close;
  return text.replace(/[\r\n]+/g, function (match) {
    return close + match + open;
  });
}

var LEVELS = {
  error: 0,
  warn: 1,
  help: 2,
  data: 3,
  info: 4,
  debug: 5,
  prompt: 6,
  verbose: 7,
  input: 8,
  silly: 9
};

var LEVEL_COLORS = {
  error: 'red',
  warn: 'yellow',
  help: 'cyan',
  data: 'grey',
  info: 'green',
  debug: 'blue',
  prompt: 'grey',
  verbose: 'cyan',
  input: 'grey',
  silly: 'magenta'
};

var STDERR_LEVELS = { error: true, debug: true };

var PAD = Math.max.apply(null, Object.keys(LEVELS).map(function (l) { return l.length; }));

function serialize(meta) {
  return Object.keys(meta).map(function (key) {
    var value = meta[key];
    if (value && typeof value === 'object') {
      value = util.inspect(value, { breakLength: Infinity, depth: 2 });
    }
    return key + '=' + value;
  }).join(', ');
}

function createLogger() {
  var logger = {
    levels: LEVELS,
    level: 'info',

    //
    // ### function log (level, msg, ...args)
    // printf-style arguments are formatted with util.format; a trailing plain
    // object is appended as `key=value` metadata.
    //
    log: function (level) {
      if (!(level in LEVELS)) {
        throw new Error('Unknown log level: ' + level);
      }
      if (LEVELS[level] > LEVELS[logger.level]) {
        return logger;
      }

      var args = Array.prototype.slice.call(arguments, 1),
          meta = null,
          last = args[args.length - 1];

      if (args.length > 1 && last && Object.prototype.toString.call(last) === '[object Object]') {
        meta = args.pop();
      }

      var stream = STDERR_LEVELS[level] ? process.stderr : process.stdout,
          msg = util.format.apply(null, args);

      if (meta && Object.keys(meta).length) {
        msg += (msg ? ' ' : '') + serialize(meta);
      }

      stream.write(
        color(LEVEL_COLORS[level], level) + ':' +
        new Array(PAD - level.length + 2).join(' ') + msg + '\n'
      );
      return logger;
    },

    // winston compatibility: prompt used to call `logger.cli()` on start-up.
    cli: function () { return logger; }
  };

  Object.keys(LEVELS).forEach(function (level) {
    logger[level] = function () {
      return logger.log.apply(null, [level].concat(Array.prototype.slice.call(arguments)));
    };
  });

  return logger;
}

module.exports = {
  createLogger: createLogger,
  color: color,
  colorEnabled: colorEnabled
};
