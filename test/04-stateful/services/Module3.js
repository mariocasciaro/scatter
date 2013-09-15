

module.exports = function() {
  return {
    svc: function() {
      return "Module3";
    }
  };
};

module.exports.__module = {
  provides: 'svc'
};