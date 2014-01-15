
var CONSTANTS = require('../constants');

function ContainerPlugin() {}

ContainerPlugin.prototype.register = function(container) {
  this.container = container;
  container.mapLoader('container', this);
};

ContainerPlugin.prototype.loadDependency = function(dependency, fromModule) {
  return {
    load: function(modName) {
      //TODO review this one
      var initOpts = fromModule.initStatus >= CONSTANTS.MODULE_TREE_INITIALIZED ? CONSTANTS.INIT_OPTION_INIT_TREE : undefined;
      return fromModule.load(modName, initOpts);
    },
    module: fromModule
  };
};

module.exports = ContainerPlugin;