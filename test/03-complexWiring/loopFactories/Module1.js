

module.exports = function(Module2) {
  var self = {
    trigger_bootstrap: function(){
      return 1;
    },
    dep: Module2
  };

  return self;
};
module.exports.__scatter = {
  provides: {trigger_bootstrap: []},
  args: ['Module2']
};