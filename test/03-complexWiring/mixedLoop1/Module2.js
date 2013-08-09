

module.exports = function(Module1) {
  var self = {
    trigger_bootstrap: function(){
      return 2;
    }
  };

  return self;
};
module.exports.__scatter = {
  provides: {trigger_bootstrap: ['Module1']},
  args: ['Module1']
};