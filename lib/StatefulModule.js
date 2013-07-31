
var _ = require('lodash'),
  CONSTANTS = require('./constants'),
  inherits = require('inherits'),
  Module = require('./Module');


function StatefulModule(name, container, data, options) {
  Module.prototype.constructor.call(this, name, container, data, options);
  this.isStateful = true;
}
inherits(StatefulModule, Module);

StatefulModule.prototype.getContext = function(property) {
  return this.container.getContext(property);
};

module.exports = StatefulModule;