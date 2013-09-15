

module.exports = function() {
  return {
    svc: function() {
      return "Module1";
    }
  };
};

module.exports.__module = {
  isStateful: true,
  provides: 'svc'
};