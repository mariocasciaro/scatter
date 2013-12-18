
module.exports = {
  simple_service: function() {
    return "l1/l2/Module1";
  },
  chain: function(arg) {
    return arg+"Module1";
  },
  one: function() {
    return "Module1";
  },
  promises: function() {
    return "Module1";
  },
  exc: function() {
    throw new Error("Catch this!");
  }
};
module.exports.__module = { 
  provides: {
    simple_service: {before: 'Module3', after: 'l1/Module2'},
    chain: {before: ['../Module2']},
    one: {before: ['l1/Module2']},
    promises: {before: ['l1/Module2']},
    exc: []
  }
};
