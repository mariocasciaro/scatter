var when = require('when');

module.exports = {
  aDep: "Module1Dep",
  a_service: function(arg) {
    return arg + " Module1";
  },
  a_promised_service: function(arg) {
    var deferred = when.defer();
    setTimeout(function() {
      deferred.resolve(arg + " Module1");
    }, 0);
    return deferred.promise;
  }
};
module.exports.__module = {
  provides: ['a_service', 'a_promised_service']
};