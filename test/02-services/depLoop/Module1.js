
module.exports = {
  simple_service: function() {
    return "Module1";
  }
};
module.exports.__module = {
  provides: {
    simple_service: {before: '**'}
  }
};