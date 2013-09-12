

module.exports = function(depObj) {
  return {
    prop: "mod1",
    dep: depObj
  };
};

module.exports.__scatter = {
  args: ['Module2']
};