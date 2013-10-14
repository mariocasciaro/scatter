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
  
  load: function(dependency, fromModule) {
    return this.container.resolver.requireNpm(dependency.name);
  }
};


loaders.context = function() {};
loaders.context.prototype = {
  register: function(container) {
    this.container = container;
    container.mapLoader('ctx', this);
  },
  
  load: function(dependency, fromModule) {
    return this.container.getContext(dependency.name);
  }
};



loaders.container = function() {};
loaders.container.prototype = {
  register: function(container) {
    this.container = container;
    container.mapLoader('container', this);
  },
  
  load: function(dependency, fromModule) {
    return {
      load: function(modName) {
        //TODO review this one
        var initOpts = fromModule.initStatus >= CONSTANTS.MODULE_TREE_INITIALIZED ? CONSTANTS.INIT_OPTION_INIT_TREE : undefined;
        return fromModule.load(modName, initOpts);
      },
      module: fromModule
    };
  }
};


loaders.delayinit = function() {};
loaders.delayinit.prototype = {
  register: function(container) {
    this.container = container;
    container.mapLoader('delayinit', this);
  },
  
  load: function(dependency, fromModule) {
    return this.container.load(dependency.name, fromModule, CONSTANTS.INIT_OPTION_DO_NOT_INIT);
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
    var fromModuleName = fromModule ? fromModule.name : '__NO_CONTEXT_MODULE';
    if(! this.services[fromModuleName]) {
      this.services[fromModuleName] = {};
    }
    
    if(! this.services[fromModuleName][serviceName]) {
      this.services[fromModuleName][serviceName] = new Service(this.container, serviceName, fromModule);
    }
  
    return this.services[fromModuleName][serviceName];
  },
  
  load: function(dependency, fromModule) {
    var service = this.getService(dependency.name, fromModule);
    if(_.isEmpty(dependency.options)) {
      return service;
    } else {
      return _.bind(service[dependency.options], service);
    }
  }
};
