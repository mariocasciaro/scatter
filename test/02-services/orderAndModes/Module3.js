var delay = require('when/delay');

module.exports = {
  simple_service: function() {
    return "Module3";
  },
  chain: function(arg) {
    return arg+"Module3";
  },
  one: function() {
  },
  promises: function() {
    return delay(200, undefined);
  }
};
module.exports.__module = {
  provides: {
    simple_service: {},
    chain: {after: ['l1/Module2']},
    one: {after: ['l1/Module2']},
    promises: {after: ['l1/l2/Module2']}
  }
};