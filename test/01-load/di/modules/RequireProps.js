
module.exports = function() {
  this.prop = "requireProps";
};

module.exports.__module = {
  type: 'constructor',
  properties: {dep: 'DepFactory'}
};


