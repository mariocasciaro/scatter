
var Plugin = require('../Plugin'),
  CONSTANTS = require('../constants'),
  inherits = require('util').inherits;

function DelayInitPlugin() {}

inherits(DelayInitPlugin, Plugin);

DelayInitPlugin.prototype.register = function(container) {
  this.container = container;
  container.mapLoader('delayinit', this);
};

DelayInitPlugin.prototype.loadDependency = function(dependency, fromModule) {
  return this.container.load(dependency.name, fromModule, CONSTANTS.INIT_OPTION_DO_NOT_INIT);
};


module.exports = DelayInitPlugin;