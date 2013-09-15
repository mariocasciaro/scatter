

module.exports = function() {
  return {
    svc: function() {
      return "Module2";
    }
  };
};

module.exports.__module = {
  isStateful: true,
  provides: 'svc'
};