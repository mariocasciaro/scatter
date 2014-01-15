
function CtxPlugin() {}

CtxPlugin.prototype.register = function(container) {
  this.container = container;
  container.mapLoader('ctx', this);
};

CtxPlugin.prototype.loadDependency = function(dependency, fromModule) {
  return this.container.getContext(dependency.name);
};

module.exports = CtxPlugin;