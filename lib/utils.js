var _ = require('lodash');

var utils = module.exports = {};

utils.applyConstruct = function(clazz, args) {
  var _bind = Function.prototype.bind;
  var _slice = Array.prototype.slice;

  return new (_bind.apply(clazz, [null].concat(_slice.call(args))))();
};

utils.delegate = function(to, method) {
  return function() {
    return this[to][method].apply(this[to], arguments);
  }
};

utils.createDelegate = function(proto, to, methods) {
  _.each(methods, function(method) {
    proto[method] = utils.delegate(to, method);
  });
};

