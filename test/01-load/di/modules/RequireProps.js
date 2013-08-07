
module.exports = function() {
  this.prop = "requireProps";
};

module.exports.__scattered = {
  type: 'constructor',
  properties: {dep: 'DepFactory'}
};


