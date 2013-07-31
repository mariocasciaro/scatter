
module.exports = {
  simple_service: function() {
    return "l1/l2/Module1";
  }
};
module.exports.__scattered = {
  provides: ['simple_service']
};