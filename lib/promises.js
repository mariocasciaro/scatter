var _ = require('lodash'),
  when = require('when');

var promises = module.exports = {};

promises.resolve = when.resolve;
promises.when = when;
promises.reject = when.reject;
promises.all = when.all;
promises.allKeys = when.all;
promises.defer = require('when/keys');
promises.timeout = require('when/timeout');

promises.napply = function(thisArg, func, args) {
  var d = when.defer();
	func.apply(thisArg, args.concat(function(err, value) {
		if(err) {
			d.reject(err);
		} else if(arguments.length > 2) {
			d.resolve(Array.prototype.slice.call(arguments, 1));
		} else {
			d.resolve(value);
		}
	}));
	return d.promise;
};

promises.ninvoke = function(thisArg, func /*var args*/) {
  var args = Array.prototype.slice.call(arguments, 2);
  return promises.napply(thisArg, thisArg[func], args);
};

promises.nfcall = function(func /*var args*/) {
  var args = Array.prototype.slice.call(arguments, 1);
  return promises.napply(this, func, args);
};
