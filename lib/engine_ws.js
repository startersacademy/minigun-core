'use strict';

const async = require('async');
const _ = require('lodash');
const WebSocket = require('ws');
const debug = require('debug')('ws');
const engineUtil = require('./engine_util');
const template = engineUtil.template;

module.exports = {
  compile: compile
};

function compile(scenarioSpec, config, ee) {
  var tasks = _.map(scenarioSpec, function(rs) {
    return createStep(rs, config, ee);
  });

  return function scenario(initialContext, callback) {
    initialContext._successCount = 0;
    initialContext._pendingRequests = _.size(
        _.reject(scenarioSpec, function(rs) {
          return (typeof rs.think === 'number');
        }));

    function zero(cb) {
      if (config.deferConnection){
        ee.emit('started');
        return cb(null, initialContext);
      } else {
        let ws = new WebSocket(config.target);
        ws.on('open', function() {
          ee.emit('started');
          return cb(null, {ws: ws});
        });
        ws.once('error', function(err) {
          debug(err);
          ee.emit('error', err.code);
          return cb(err, {});
        });
      }
    }

    let steps = _.flatten([
      zero,
      tasks
    ]);

    async.waterfall(
        steps,
        function scenarioWaterfallCb(err, context) {
          if (err) {
            debug(err);
          }
          if (context.ws) {
            context.ws.close();
          }
          return callback(err, context);
        });
  };
}

function createStep(requestSpec, config, ee) {
  if (requestSpec.think) {
    return engineUtil.createThink(requestSpec);
  }

  let connect = function(context, callback) {
    let params = requestSpec.connect;
    let uri = maybePrependBase(template(params.url, context), config);
    let ws = new WebSocket(uri);
    ws.on('open', function() {
      context.ws = ws;
      return callback(null, context);
    });
    ws.once('error', function(err) {
      debug(err);
      ee.emit('error', err.code);
      return callback(err, {});
    });
  };

  let send = function(context, callback) {
    let params = requestSpec.send;
    var message = '';
    if (params.json) {
      message = JSON.stringify(template(params.json, context));
    } else {
      message = params;
    }
    ee.emit('request');
    let startedAt = process.hrtime();
    context.ws.send(message, function(err) {
      if (err) {
        debug(err);
        ee.emit('error', err);
      } else {
        let endedAt = process.hrtime(startedAt);
        let delta = (endedAt[0] * 1e9) + endedAt[1];
        ee.emit('response', delta, 0);
      }
      return callback(err, context);
    });
  };

  if (requestSpec.send){
    return send;
  } else {
    return connect;
  }

}

function maybePrependBase(uri, config) {

  if (_.startsWith(uri, '/')) {
    return config.target + uri;
  } else {
    return uri;
  }
}
