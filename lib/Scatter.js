var _ = require('lodash'),
  Container = require('./Container'),
  CONSTANTS = require('./constants'),
  fs = require('fs'),
  path = require('path'),
  Resolver = require('./Resolver');


/**
 *
 */
function Scatter(options) {
  this.options = options = options ? _.clone(options) : {};
  
  _.defaults(options, {
    instantiateTimeout: 5000,
    initializeTimeout: 5000
  });
  
  if(options.log !== void 0) {
    this.log = options.log;
  } else {
    this.log = options.log = function(){};
  }
  
  if(options.startProfiling !== void 0) {
    this.startProfiling = options.startProfiling;
  } else {
    this.startProfiling = options.startProfiling = function(){
      return {
        start: function(){},
        pause: function(){},
        end: function(){}
      };
    };
  }

  this.resolver = new Resolver(options);
  
  
  options.plugins = options.plugins || [];
  
  var pluginsRoot = path.join(__dirname, 'plugins');
  options.plugins = options.plugins.concat(fs.readdirSync(pluginsRoot)
    .map(function(plugin) {
      var pluginClass = require(path.join(pluginsRoot, plugin));
      return new pluginClass();
    }));
  this.container = new Container(this.resolver, options);
}

Scatter.prototype.registerParticles = function() {
  return this.resolver.registerParticles.apply(this.resolver, arguments);
};

Scatter.prototype.registerParticle = function() {
  return this.resolver.registerParticles.apply(this.resolver, arguments);
};

Scatter.prototype.setNodeModulesDir = function() {
  return this.resolver.setNodeModulesDir.apply(this.resolver, arguments);
};

Scatter.prototype.assemble = function(scope) {
  return this.container.assemble(scope);
};

/**
 *
 * @returns {*}
 * @private
 */
Scatter.prototype.initializeAll = function() {
  return this.container.initializeAll();
};

Scatter.prototype.load = function(name) {
  return this.container.load(name, undefined, CONSTANTS.INIT_OPTION_INIT_TREE);
};

Scatter.prototype.newStatefulContainer = function(context) {
  return this.container.newStatefulContainer(context);
};

Scatter.prototype.registerModule = function() {
  return this.container.registerModule.apply(this.container, arguments);
};

Scatter.prototype.registerModuleInstance = function() {
  return this.container.registerModuleInstance.apply(this.container, arguments);
};

module.exports = Scatter;
