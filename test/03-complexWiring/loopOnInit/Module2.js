

module.exports = function() {
  var self = {
    prop: "Module2",
    otherInitialized: true,
    svc: function() {
      return "Module2";
    },
    initialized: false
  };

  return self;
};
module.exports.__module = {
  initialize: [['Module1'], function(Module1) {
    this.otherInitialized = Module1.initialized;
    this.dep = Module1;
    this.initialized = true;
  }],
  provides: 'svc'
};