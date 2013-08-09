
module.exports = function(Module1) {
  return {
    thisIsDynamic: true,
    data: 'Module2'
  };
};

module.exports.__scatter = {
  isStateful: true,
  args: ["Module1"]
};