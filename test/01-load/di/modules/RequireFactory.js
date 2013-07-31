
module.exports = function(depObj) {
  return {
    prop: "requireFactory",
    dep: depObj
  };
};

module.exports.__scattered = {
  bootstrapMode: 'factory',
  args: ['anamespace/DepObj']
};


