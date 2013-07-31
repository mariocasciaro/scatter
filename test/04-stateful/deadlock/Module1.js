

module.exports = function(Module2) {
  return {
    data: 'Module1'
  };
};

module.exports.__scattered = {
  isStateful: true,
  args: ['Module2']
};