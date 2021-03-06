'use strict';

var _ = require('lodash');
var osenv = require('osenv');
var path = require('path');
var promise = require('bluebird');

var fs = require('fs');
promise.promisifyAll(fs);

var mkdirp = promise.promisify(require('mkdirp'));

exports.configDir = function() {
  return path.join(osenv.home(),
                   process.platform === 'win32' ? '_kapit' : '.kapit');
};

exports.defaultDataFilename = function() {
  return path.join(exports.configDir(), 'state.json');
};

var defaults = {
  current: -1,
  chains: []
};

var data = _.cloneDeep(defaults);

var newChain = {
  name: 'New Chain',
  current: -1,
  steps: []
};

var newStep = {
  name: 'New Request',
  type: 'HTTP',
  raw: false,
  request: {
    url: '',
    method: 'GET',
    json: true
  },
  response: {
    completed: false,
    error: false
  },
  render: {}
};

exports.getFilename = function() {
  return data.filename;
};

exports.raw = function() {
  return exports.getCurrentStep().raw;
};

exports.toggleRaw = function() {
  var step = exports.getCurrentStep();
  step.raw = !step.raw;
};

exports.save = function() {
  var filename = data.filename || exports.defaultDataFilename();

  return mkdirp(exports.configDir())
    .then(function() {
      return fs.writeFileAsync(filename,
                               JSON.stringify(data, null, 2),
                               { mode: 384 });
    });
};

exports.load = function() {
  var filename = process.argv[2] || exports.defaultDataFilename();

  return fs.readFileAsync(filename)
    .then(JSON.parse)
    .then(function(val) {
      data = val;
      return data;
    })
    .catch(function() {
      // If there is no data file to load, just use the defaults
      data = _.cloneDeep(defaults);
      data.filename = filename;
    });
};

exports.getChains = function() {
  return data.chains;
};

exports.getChainNames = function() {
  return _.map(data.chains, function(chain) {
    return chain.name;
  });
};

exports.getChain = function(index) {
  return data.chains[index] || null;
};

exports.getCurrentChain = function() {
  return exports.getChain(data.current);
};

exports.getCurrentSteps = function() {
  var chain = exports.getCurrentChain();
  if (_.isArray(chain.steps)) {
    return chain.steps;
  } else {
    return [];
  }
};

exports.getCurrentStep = function() {
  var chain = exports.getCurrentChain();
  if (chain) {
    return chain.steps[chain.current];
  } else {
    return null;
  }
};

exports.newChain = function() {
  var c = _.cloneDeep(newChain);
  var length = data.chains.push(c);
  data.current = length - 1;
  return c;
};

exports.newStep = function() {
  var s = _.cloneDeep(newStep);
  var chain = exports.getCurrentChain();
  var length = chain.steps.push(s);
  chain.current = length - 1;
  return s;
};

exports.deleteStep = function() {
  var chain = exports.getCurrentChain();
  var removed = chain.steps.splice(chain.current, 1);

  chain.current--;
  if (chain.steps.length > 0 && chain.current === -1) {
    chain.current = 0;
  }

  return removed;
};

exports.resetAllSteps = function(d) {
  _.each((d || data).chains, function(chain) {
    _.each(chain.steps, function(step) {
      exports.resetStep(step);
    });
  });
};

exports.resetStep = function(step) {
  step = step || exports.getCurrentStep();
  step.response = _.cloneDeep(newStep.response);
  delete step.compiled;
  delete step.render.response;
};

exports.nextStep = function() {
  var chain = exports.getCurrentChain();
  if (chain) {
    chain.current = Math.min((chain.steps.length - 1), chain.current + 1);
  }
};

exports.prevStep = function() {
  var chain = exports.getCurrentChain();
  if (chain) {
    chain.current = Math.max(0, chain.current - 1);
  }
};

exports.context = function() {
  var chain = exports.getCurrentChain();

  if (chain) {
    return _.reduce(chain.steps, function(context, step) {
      context[step.name] = {
        request: _.cloneDeep(step.request),
        response: _.cloneDeep(step.response)
      };

      return context;
    }, {});
  } else {
    return null;
  }
};
