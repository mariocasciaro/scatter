
module.exports = {
  simple_service2: function() {
    return "Module4";
  },
  
  simple_service3: function() {
    return "Module4";
  }
};
module.exports.__module = {
  provides: {
    simple_service2: {after: 'Module3'}
  }
};
