module.exports = function (dep) {
  return {
    prop: "module1",
    depProp: dep.prop
  };
};

module.exports.__module = {
  args: ['dep']
};