
module.exports = function(depFactory) {
  this.prop = "requireConstr";
  this.dep = depFactory;
};

module.exports.__scatter = {
  type: 'constructor',
  args: ['DepFactory']
};
