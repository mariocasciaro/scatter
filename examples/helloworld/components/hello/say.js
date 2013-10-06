

module.exports = function(what) {
  return {
    doSay: function() {
      console.log("Hello " + what + "!");
    }
  };
};

module.exports.__module = {
  args: ['what']
};