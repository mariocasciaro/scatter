var CONSTANTS = require('./constants'),
  _ = require('lodash'),
  Service = require('./Service');

var loaders = module.exports = {};


loaders.npm = function() {};
loaders.npm.prototype = {
  register: function(container) {
    this.container = container;
    container.mapLoader('npm', this);
  },
  
  load: function(dependencyName, loaderName, loaderOptions, fromModule, ensureInitialized) {
    return this.container.resolver.requireNpm(dependencyName);
  }
};


loaders.context = function() {};
loaders.context.prototype = {
  register: function(container) {
    this.container = container;
    container.mapLoader('ctx', this);
  },
  
  load: function(dependencyName, loaderName, loaderOptions, fromModule, ensureInitialized) {
    return this.container.getContext(dependencyName);
  }
};



loaders.container = function() {};
loaders.container.prototype = {
  register: function(container) {
    this.container = container;
    container.mapLoader('scatter', this);
  },
  
  load: function(dependencyName, loaderName, loaderOptions, fromModule, ensureInitialized) {
    return {
      load: function(modName) {
        var ensureInit = fromModule.initStatus >= CONSTANTS.MODULE_WIRED;
        return fromModule.load(modName, ensureInit);
      }
    };
  }
};


loaders.service = function() {};
loaders.service.prototype = {
  register: function(container) {
    this.container = container;
    this.services = {};
    container.mapLoader('svc', this);
  },
  
  getService: function(serviceName, fromModule) {
    var self = this;
    if(! self.services[fromModule]) {
      self.services[fromModule] = {};
    }
    
    if(! self.services[fromModule][serviceName]) {
      self.services[fromModule][serviceName] = new Service(self.container, serviceName, fromModule);
    }
  
    return self.services[fromModule][serviceName];
  },
  
  load: function(dependencyName, loaderName, loaderOptions, fromModule, ensureInitialized) {
    var service = this.getService(dependencyName, fromModule);
    if(_.isEmpty(loaderOptions)) {
      return service;
    } else {
      return _.bind(service[loaderOptions], service);
    }
  }
};
