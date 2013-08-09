
module.exports = function(depObj) {
  return {
    prop: "requireFactory",
    dep: depObj
  };
};

module.exports.__scatter = {
  bootstrapMode: 'factory',
  args: ['anamespace/DepObj']
};


