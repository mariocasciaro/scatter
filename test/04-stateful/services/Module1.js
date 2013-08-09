

module.exports = function() {
  return {
    svc: function() {
      return "Module1";
    }
  };
};

module.exports.__scatter = {
  isStateful: true,
  provides: 'svc'
};