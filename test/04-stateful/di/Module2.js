
var count = 0;
module.exports = function() {
  count++;
  return {
    count: count,
    data: 'Module2'
  };
};

module.exports.__scatter = {
  isStateful: true
};