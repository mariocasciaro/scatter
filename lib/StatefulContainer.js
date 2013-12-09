
var _ = require('lodash'),
  utils = require('./utils'),
  CONSTANTS = require('./constants'),
  StatefulModule = require('./StatefulModule'),
  inherits = require('inherits'),
  Container = require('./Container');


function StatefulContainer(staticContainer, context, options) {
  Container.prototype.constructor.call(this, null, options);
  this.staticContainer = staticContainer;
  this.context = context;
  this.isStateful = true;
}
inherits(StatefulContainer, Container);
utils.createDelegate(StatefulContainer.prototype, 'staticContainer', [
  'resolveAll', 'assemble', 'getProviderModules'
]);


StatefulContainer.prototype.newStatefulModule = function(name, data) {
  return new StatefulModule(name, this, data, this.options);
};

/**
 *
 * @param name
 * @returns {*}
 * @private
 */
StatefulContainer.prototype.resolveModule = function(name) {
  var mod = this.modules[name];
  if(mod !== void 0) {
    return mod;
  }

  var staticModule = this.staticContainer.resolveModule(name);
  if(staticModule.annotations.isStateful) {
    mod = this.newStatefulModule(name, {
      rawModule: staticModule.rawModule,
      annotations: staticModule.annotations
    });
  } else {
    //just copy it
    mod = staticModule;
  }
  this.setModule(name, mod);
  return mod;
};


StatefulContainer.prototype.getContext = function(property) {
  if(_.isEmpty(property)) {
    return this.context;
  }
  return this.context[property];
};

module.exports = StatefulContainer;
