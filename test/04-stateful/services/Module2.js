

module.exports = function() {
  return {
    svc: function() {
      return "Module2";
    }
  };
};

module.exports.__scattered = {
  isStateful: true,
  provides: 'svc'
};