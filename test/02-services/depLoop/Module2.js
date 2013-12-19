
module.exports = {
  simple_service: function() {
    return "Module2";
  },
  
  simple_service2: function() {
    return "Module2";
  }
};
module.exports.__module = {
  provides: {
    simple_service: {after: 'Module3'},
    simple_service2: {before: '**'}
  }
};
