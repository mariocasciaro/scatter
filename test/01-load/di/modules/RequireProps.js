
module.exports = function() {
  this.prop = "requireProps";
};

module.exports.__scatter = {
  type: 'constructor',
  properties: {dep: 'DepFactory'}
};


