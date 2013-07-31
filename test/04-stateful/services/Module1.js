

module.exports = function() {
  return {
    svc: function() {
      return "Module1";
    }
  };
};

module.exports.__scattered = {
  isStateful: true,
  provides: 'svc'
};