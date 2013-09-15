

module.exports = function() {
  var self = {
    name: "mod2",
    trigger_bootstrap: function(){
      return "2"+self.dep.name;
    }
  };

  return self;
};
module.exports.__module = {
  provides: {trigger_bootstrap: []},
  properties: {dep: 'Module1'}
};