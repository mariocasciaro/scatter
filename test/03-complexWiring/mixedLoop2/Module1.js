

module.exports = function(Module2) {
  var self = {
    name: "mod1",
    trigger_bootstrap: function(){
      return "1"+self.dep.name;
    },
    dep: Module2
  };

  return self;
};
module.exports.__module = {
  provides: {trigger_bootstrap: []},
  args: ['delayinit!Module2']
};