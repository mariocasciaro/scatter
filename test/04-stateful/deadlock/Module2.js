
module.exports = function(Module1) {
  return {
    thisIsDynamic: true,
    data: 'Module2'
  };
};

module.exports.__module = {
  isStateful: true,
  args: ["Module1"]
};