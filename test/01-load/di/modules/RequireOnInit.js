
module.exports = function() {
  this.prop = "requireConstr";
};

module.exports.__scattered = {
  type: 'constructor',
  initialize: [['DepFactory'], function(dep) {
    this.dep = dep;
  }]
};


