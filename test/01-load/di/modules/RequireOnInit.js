
module.exports = function() {
  this.prop = "requireConstr";
};

module.exports.__scatter = {
  type: 'constructor',
  initialize: [['DepFactory'], function(dep) {
    this.dep = dep;
  }]
};


