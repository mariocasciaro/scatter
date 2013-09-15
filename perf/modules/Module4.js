var when = require('when');

module.exports = function(ctx) {
  return {
    aDep: "Module4",
    a_dyn_service: function(arg) {
      return when.resolve(arg + ctx + "Module4");
    }
  }
};
module.exports.__module = {
  isStateful: true,
  args: ['ctx!'],
  provides: ['a_dyn_service']
};