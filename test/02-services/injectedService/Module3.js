var delay = require('when/delay');

module.exports = {
  simple_service: function() {
    return "Module3";
  }
};
module.exports.__module = {
  provides: {
    simple_service: {}
  }
};