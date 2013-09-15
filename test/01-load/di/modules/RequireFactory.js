
module.exports = function(depObj) {
  return {
    prop: "requireFactory",
    dep: depObj
  };
};

module.exports.__module = {
  bootstrapMode: 'factory',
  args: ['anamespace/DepObj']
};


