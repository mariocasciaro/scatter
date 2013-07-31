
module.exports = {
  simple_service: function() {
    return "l1/Module2";
  }
};
module.exports.__scattered = {
  provides: ['simple_service']
};