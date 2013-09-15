
module.exports = function() {
  this.prop = "requireConstr";
};

module.exports.__module = {
  type: 'constructor',
  initialize: [['DepFactory'], function(dep) {
    this.dep = dep;
  }]
};


