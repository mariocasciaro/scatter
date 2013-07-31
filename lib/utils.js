var _ = require('lodash');

var utils = module.exports = {};

utils.applyConstruct = function(clazz, args) {
  var obj, newobj;
  function TmpClazz() {
  }
  TmpClazz.prototype = clazz.prototype;
  obj = new TmpClazz();
  obj.constructor = clazz;
  newobj = clazz.apply(obj, args);
  //function constructor?
  if (newobj !== null
  && (typeof newobj === "object" || typeof newobj === "function")
  ) {
    obj = newobj;
  }
  return obj;
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

