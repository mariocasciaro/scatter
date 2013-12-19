
module.exports = {
  simple_service: function() {
    return "Module3";
  },
  
  simple_service2: function() {
    return "Module3";
  }
};
module.exports.__module = {
  provides: {
    simple_service: {before: '**'},
    simple_service2: {before: '**'}
  }
};
