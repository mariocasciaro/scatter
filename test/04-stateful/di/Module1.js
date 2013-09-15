
var count = 0;
module.exports = function(Module2, Module3) {
  count++;
  return {
    count: count,
    dep: Module2,
    staticDep: Module3
  };
};

module.exports.__module = {
  isStateful: true,
  args: ['Module2', 'Module3']
};