
var Plugin = require('../../Plugin'),
  Service = require('./Service'),
  _ = require('lodash'),
  inherits = require('util').inherits;

function SvcPlugin() {}

inherits(SvcPlugin, Plugin);

SvcPlugin.prototype.register = function(container) {
  this.container = container;
  this.services = {};
  container.mapLoader('svc', this);
};

SvcPlugin.prototype.loadDependency = function(dependency, fromModule) {
  var service = this.getService(dependency.name, fromModule);
  if(_.isEmpty(dependency.options)) {
    return service;
  } else {
    return service[dependency.options].bind(service);
  }
};


SvcPlugin.prototype.getService = function(serviceName, fromModule) {
  var fromModuleName = fromModule ? fromModule.name : '__NO_CONTEXT_MODULE';
  if(! this.services[fromModuleName]) {
    this.services[fromModuleName] = {};
  }

  if(! this.services[fromModuleName][serviceName]) {
    this.services[fromModuleName][serviceName] = new Service(this.container, serviceName, fromModule);
  }

  return this.services[fromModuleName][serviceName];
};

module.exports = SvcPlugin;
