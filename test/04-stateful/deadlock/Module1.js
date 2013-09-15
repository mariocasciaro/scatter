

module.exports = function(Module2) {
  return {
    data: 'Module1'
  };
};

module.exports.__module = {
  isStateful: true,
  args: ['Module2']
};