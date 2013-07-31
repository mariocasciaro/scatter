

module.exports = function(ctx, ctxData) {
  return {
    data: ctx,
    anotherData: ctxData
  };
};

module.exports.__scattered = {
  isStateful: true,
  args: ['ctx!', 'ctx!data']
};