

module.exports = function(ctx, ctxData) {
  return {
    data: ctx,
    anotherData: ctxData
  };
};

module.exports.__scatter = {
  isStateful: true,
  args: ['ctx!', 'ctx!data']
};