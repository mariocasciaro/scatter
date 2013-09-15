
var self = module.exports = {
  getName: function() {
    return self.aDep.name;
  }
};
module.exports.__module = {
  properties: {
    aDep: 'Module3'
  }
};