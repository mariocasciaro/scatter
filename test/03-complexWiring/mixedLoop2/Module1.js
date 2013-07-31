

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
module.exports.__scattered = {
  provides: {trigger_bootstrap: []},
  args: ['Module2']
};