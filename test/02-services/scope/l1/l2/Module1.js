
module.exports = {
  simple_service: function() {
    return "l1/l2/Module1";
  },

  simple_service_generic: function() {
    return "l1/l2/Module1(gen)";
  }
};
module.exports.__module = {
  provides: {
    "l1/simple_service": {},
    "simple_service": {handler: 'simple_service_generic'}
  }
};