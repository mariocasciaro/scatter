
module.exports = {
  simple_service: function() {
    return "l1/Module2";
  },

  simple_service_generic: function() {
    return "l1/Module2(gen)";
  }
};
module.exports.__module = {
  provides: {
    "l1/simple_service": {},
    "simple_service": {handler: 'simple_service_generic'}
  }
};