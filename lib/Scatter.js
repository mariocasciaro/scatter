var _ = require('lodash'),
Container = require('./Container'),
Resolver = require('./Resolver');


/**
 * How to define a scattered module:
 * module.exports.__scatter = {
 *  provides: "serviceName" OR ["serviceName1", "service2"] OR {service1: ["afterthis", "andthat"]} OR {service1: {after:[], before:[]}}
 *  properties: {name: "dep" },
 *  args: ['dep']
 *  initialize: 'methodName' OR function(),
 *  type: one between 'object', 'factory', 'constructor'
 *  isStateful: true or false
 * }
 *
 * @param options <code>{
 *  loadTimeout: ...
 *  log:
 *  startProfiling
 * }</code>
 * @constructor
 */
function Scatter(options) {
  this.options = options = options ? _.clone(options) : {};
  
  _.defaults(options, {
    instantiateTimeout: 700,
    initializeTimeout: 700
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
  this.container = new Container(this.resolver, options);
}

Scatter.prototype.configureRoots = function() {
  return this.resolver.configureRoots.apply(this.resolver, arguments);
};

Scatter.prototype.addRoots = function() {
  return this.resolver.addRoots.apply(this.resolver, arguments);
};

Scatter.prototype.discoverRoots = function() {
  return this.resolver.discoverRoots.apply(this.resolver, arguments);
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
Scatter.prototype.bootstrapAll = function() {
  return this.container.bootstrapAll();
};

Scatter.prototype.load = function(name) {
  return this.container.load(name, undefined, true);
};

Scatter.prototype.newStatefulContainer = function(context) {
  return this.container.newStatefulContainer(context);
};

Scatter.prototype.registerModule = function(name, rawModule, descriptor) {
  return this.container.registerModule.apply(this.container, arguments);
};

Scatter.prototype.registerModuleInstance = function(name, module, descriptor) {
  return this.container.registerModuleInstance.apply(this.container, arguments);
};

module.exports = Scatter;
