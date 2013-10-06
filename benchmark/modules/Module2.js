var when = require('when');

module.exports = function(Module1) {
  return {
    a_service: function(arg) {
      return arg + Module1.aDep + "Module1";
    },
    a_promised_service: function(arg) {
      return when.resolve(arg + Module1.aDep + "Module1");
    }
  }
};
module.exports.__module = {
  args: ['Module1'],
  provides: ['a_service', 'a_promised_service']
};