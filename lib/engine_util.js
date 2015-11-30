'use strict';

const debug = require('debug')('engine_util');
const mustache = require('mustache');
const traverse = require('traverse');
const esprima = require('esprima');
const _ = require('lodash');
const vm = require('vm');

module.exports = {
  createThink: createThink,
  template: template,
  evil: evil
};

function createThink(requestSpec) {
  let thinktime = requestSpec.think * 1000;

  let f = function(context, callback) {
    debug('think %s -> %s', requestSpec.think, thinktime);
    setTimeout(function() {
      callback(null, context);
    }, thinktime);
  };

  return f;
}

function template(o, context) {
  let result;
  if (typeof o === 'object') {
    result = traverse(o).map(function(x) {

      if (typeof x === 'string') {
        this.update(template(x, context));
      } else {
        return x;
      }
    });
  } else {
    const funcCallRegex = /{{\s*(\$[A-Za-z0-9_]+\s*\(\s*.*\s*\))\s*}}/;
    let match = o.match(funcCallRegex);
    if (match) {
      // This looks like it could be a function call:
      const syntax = esprima.parse(match[1]);
      /* eslint-disable */
      // TODO: Use a proper schema for what we expect here
      /* eslint-enable */
      if (syntax.body && syntax.body.length === 1 &&
          syntax.body[0].type === 'ExpressionStatement') {
        let funcName = syntax.body[0].expression.callee.name;
        let args = _.map(syntax.body[0].expression.arguments, function(arg) {
          return arg.value;
        });
        if (funcName in context.funcs) {
          return template(o.replace(funcCallRegex, context.funcs[funcName].apply(null, args)), context);
        }
      }
    } else {
      result = mustache.render(o, context.vars);
    }
  }
  return result;
}

// Presume code is valid JS code (i.e. that it has been checked elsewhere)
function evil(sandbox, code) {
  let context = vm.createContext(sandbox);
  let script = new vm.Script(code);
  return script.runInContext(context);
}
