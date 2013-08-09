

module.exports = function() {
  return {
    svc: function() {
      return "Module2";
    }
  };
};

module.exports.__scatter = {
  isStateful: true,
  provides: 'svc'
};