

module.exports = function(Module2) {
  return {
    data: 'Module1'
  };
};

module.exports.__scatter = {
  isStateful: true,
  args: ['Module2']
};