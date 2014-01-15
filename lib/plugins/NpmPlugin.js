
function NpmPlugin() {}

NpmPlugin.prototype.register = function(container) {
  this.container = container;
  container.mapLoader('npm', this);
};

NpmPlugin.prototype.loadDependency = function(dependency, fromModule) {
  return this.container.resolver.requireNpm(dependency.name);
};


module.exports = NpmPlugin;