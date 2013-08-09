

module.exports = function(dep) {
  return {
    prop: "requireDynamicErr",
    dep: dep
  };
};

module.exports.__scatter = {
  args: ['anamespace/DepDyn']
};


