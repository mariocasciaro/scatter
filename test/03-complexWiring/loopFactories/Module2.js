

module.exports = function(Module1) {
  var self = {
    trigger_bootstrap: function(){
      return 2;
    },
    prop: "Module2"
  };

  return self;
};
module.exports.__module = {
  provides: {trigger_bootstrap: []},
  args: ['Module1']
};