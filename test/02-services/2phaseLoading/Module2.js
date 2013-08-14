
var self = module.exports = {
  getName: function() {
    return self.aDep.name;
  }
};
module.exports.__scatter = {
  properties: {
    aDep: 'Module3'
  }
};