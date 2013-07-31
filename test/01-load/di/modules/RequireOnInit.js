
module.exports = function() {
  this.prop = "requireConstr";
};

module.exports.__scattered = {
  mode: 'constructor',
  initialize: [['DepFactory'], function(dep) {
    this.dep = dep;
  }]
};


