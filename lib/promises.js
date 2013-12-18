var _ = require('lodash'),
  when = require('when');

var promises = module.exports = {};

promises.isPromiseLike = when.isPromiseLike;
promises.resolve = when.resolve;
promises.when = when;
promises.reject = when.reject;
promises.all = when.all;
promises.allKeys = when.all;
promises.defer = when.defer;
promises.timeout = require('when/timeout');
