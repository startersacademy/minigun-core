'use strict';

var test = require('tape');
var template = require('../../lib/engine_util').template;

// TO DO:
// plain strings
// string with a {{}}
// string with multiple {{}}s
// string with a function
// string with multiple functions
// string with a function and a {{}}
// same but for an object

// variables that aren't defined
// functions that aren't defined

var emptyContext = { vars: {} };

test('templating a plain string should return the same string', function(t) {
  t.assert(template('string', emptyContext) === 'string', '');
  t.assert(template('string {}', emptyContext) === 'string {}', '');
  t.end();
});

test.test('variables can be substituted', function(t) {
  t.assert(template('hello {{name}}', { vars: { name: 'Hassy'} }) === 'hello Hassy', '');
  t.assert(template('hello {{name}}', emptyContext) === 'hello ', '');
  t.end();
});
