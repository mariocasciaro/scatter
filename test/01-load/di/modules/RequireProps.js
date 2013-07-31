
module.exports = function() {
  this.prop = "requireProps";
};

module.exports.__scattered = {
  mode: 'constructor',
  properties: {dep: 'DepFactory'}
};


