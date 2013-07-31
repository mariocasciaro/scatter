

module.exports = function(depObj) {
  return {
    prop: "mod1",
    dep: depObj
  };
};

module.exports.__scattered = {
  args: ['Module2']
};