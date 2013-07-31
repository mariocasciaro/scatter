var _ = require('lodash'),
Container = require('./Container'),
Resolver = require('./Resolver');


/**
 * How to define a scattered module:
 * module.exports.__scattered = {
 *  provides: "serviceName" OR ["serviceName1", "service2"] OR {service1: ["afterthis", "andthat"]} OR {service1: {after:[], before:[]}}
 *  name: 'ModuleName',
 *  properties: {name: "dep" },
 *  args: ['dep']
 *  initialize: 'methodName' OR function(),
 *  mode: one between 'object', 'factory', 'constructor'
 *  isStateful: true or false
 * }
 *
 * @param options <code>{
 *  roots: [],
 *  loadTimeout: ...
 *  log:
 *  startProfiling
 * }</code>
 * @constructor
 */
function Scatter(options) {
  this.options = options = options ? _.clone(options) : {};
  
  _.defaults(options, {
    loadTimeout: 700
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
        end: function(){}
      };
    };
  }

  var resolver = new Resolver(options);
  this.container = new Container(resolver, options);
}


/**
 *
 * @returns {*}
 */
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
  return this.container.load(name);
};

Scatter.prototype.getProvider = function(name) {
  return this.container.getProvider(name);
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
