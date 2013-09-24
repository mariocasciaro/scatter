
module.exports = {
  simple_service: function() {
    return "Module2";
  }
};
module.exports.__module = {
  provides: {
    simple_service: {after: 'Module3'}
  }
};