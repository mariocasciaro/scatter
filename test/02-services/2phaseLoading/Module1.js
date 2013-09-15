
var self = module.exports = {
  service: function() {
    return self.aDep.getName();
  },

  __module: {
    properties: {aDep: 'Module2'},
    provides: {
      service: {}
    }
  }
};