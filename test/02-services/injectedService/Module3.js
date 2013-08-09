var delay = require('when/delay');

module.exports = {
  simple_service: function() {
    return "Module3";
  }
};
module.exports.__scatter = {
  provides: {
    simple_service: {}
  }
};