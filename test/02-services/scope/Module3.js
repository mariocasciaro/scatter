
module.exports = {
  simple_service: function() {
    return "Module3";
  }
};
module.exports.__scattered = {
  provides: ['simple_service']
};