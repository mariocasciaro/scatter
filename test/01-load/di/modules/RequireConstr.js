
module.exports = function(depFactory) {
  this.prop = "requireConstr";
  this.dep = depFactory;
};

module.exports.__module = {
  type: 'constructor',
  args: ['DepFactory']
};
