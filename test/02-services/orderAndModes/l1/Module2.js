var delay = require('when/delay');

module.exports = {
  simple_service: function() {
    return "l1/Module2";
  },
  chain: function(arg) {
    return arg+"Module2";
  },
  one: function() {
    return "Module2";
  },
  promises: function() {
    return delay(700000, "Module2");
  }
};
module.exports.__module = {
  provides: ['simple_service', 'chain', 'one', 'promises']
};