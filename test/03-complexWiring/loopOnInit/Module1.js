

module.exports = {
  prop: 'Module1',
  svc: function() {
    return "Module1"
  },
  initialized: true
};
module.exports.__module = {
  initialize: [['Module2'], function(Module2) {
    this.initialized = true;
    this.otherInitialized = Module2.initialized;
    this.dep = Module2;
  }],
  provides: {svc: ["Module2"]}
};