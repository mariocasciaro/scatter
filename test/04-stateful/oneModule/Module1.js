
var counter = 0;

module.exports = function() {
  counter++;
  return {
    counter: counter,
    thisIsDynamic: true
  };
};

module.exports.__module = {
  isStateful: true
};