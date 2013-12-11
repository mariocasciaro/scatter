var when = require('when');

module.exports = function(Module4) {
  return {
    a_dyn_service: function(arg) {
      return when.resolve(arg + Module4.aDep + "Module3");
    }
  }
};
module.exports.__module = {
  isStateful: true,
  args: ['Module4'],
  provides: ['a_dyn_service']
};