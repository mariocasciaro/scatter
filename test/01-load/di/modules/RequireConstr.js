
module.exports = function(depFactory) {
  this.prop = "requireConstr";
  this.dep = depFactory;
};

module.exports.__scattered = {
  type: 'constructor',
  args: ['DepFactory']
};
