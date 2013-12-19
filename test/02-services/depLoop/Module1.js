
module.exports = {
  simple_service: function() {
    return "Module1";
  },
  
  simple_service2: function() {
    return "Module1";
  }
};
module.exports.__module = {
  provides: {
    simple_service: {before: '**'},
    simple_service2: {before: './**', after: "Module3"}
  }
};
