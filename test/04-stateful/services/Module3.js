

module.exports = function() {
  return {
    svc: function() {
      return "Module3";
    }
  };
};

module.exports.__scatter = {
  provides: 'svc'
};