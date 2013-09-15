

module.exports = function(ctx, ctxData) {
  return {
    data: ctx,
    anotherData: ctxData
  };
};

module.exports.__module = {
  isStateful: true,
  args: ['ctx!', 'ctx!data']
};