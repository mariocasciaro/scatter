

module.exports = function() {
  var self = {
    trigger_bootstrap: function() {
      return 1;
    }
  };

  return self;
};
module.exports.__module = {
  provides: {trigger_bootstrap: []},
  properties: ['Module2']
};