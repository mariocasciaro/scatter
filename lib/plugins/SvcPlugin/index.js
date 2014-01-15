
var Service = require('./Service'),
  _ = require('lodash');

function SvcPlugin() {}

SvcPlugin.prototype.register = function(container) {
  this.container = container;
  this.services = {};
  container.mapLoader('svc', this);
};

SvcPlugin.prototype.processAnnotations = function(annotations, module) {
  var provides = annotations.provides;
  //Normalize provide annotations
  var normProvides = {};
  if(provides) {
    if(_.isString(provides)) {
      normProvides[provides] = {};
    } else if(_.isArray(provides)) {
      _.each(provides, function(provideDesc) {
        if(!_.isString(provideDesc)) {
          throw new TypeError("Provided service must be a string");
        }
        normProvides[provideDesc] =  {};
      });
    } else {
      //scan object
      _.each(provides, function(provideDesc, provideName) {
        var after, before;
        if(_.isArray(provideDesc)) {
          after = provideDesc;
        } else {
          after = _.isArray(provideDesc.after) ? provideDesc.after :
            (provideDesc.after ? [provideDesc.after] : null);
          before = _.isArray(provideDesc.before) ? provideDesc.before :
            (provideDesc.before ? [provideDesc.before] : null);
        }
        normProvides[provideName] =  {
          after: _.map(after, module.resolveDependencyName, module),
          before: _.map(before, module.resolveDependencyName, module)
        };
        
        normProvides[provideName].handler = provideDesc.handler;
      });
    }
  }
  
  annotations.provides = normProvides;
};

SvcPlugin.prototype.loadDependency = function(dependency, fromModule) {
  var service = this.getService(dependency.name, fromModule);
  if(_.isEmpty(dependency.options)) {
    //by defeault bind to the 'sequence' function
    return service.sequence.bind(service);
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
