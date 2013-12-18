

module.exports = function(Module3) {
  return {
    prop: "Module",
    mod3: Module3
  };
};

module.exports.__module = {
  properties: {
    mod2: "./Module2",
    mod1: "../Module1"
  },
  args: ["./namespace1/Module3"]
}
