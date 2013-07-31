

module.exports = function() {
  var self = {
    trigger_bootstrap: function(){
      return 1;
    }
  };

  return self;
};
module.exports.__scattered = {
  provides: {trigger_bootstrap: []},
  properties: ['Module2']
};