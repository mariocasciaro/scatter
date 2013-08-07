var _ = require('lodash'),
  Promises = require('./promises'),
  Constants = require('./constants'),
  utils = require('./utils');

/**
 *
 * @param name
 * @param container
 * @param data
 * @param options
 * @constructor
 */
function Module(name, container, data, options) {
  this.name = name;
  this.container = container;

  this.options = options;
  this.log = this.options.log;
  this.startProfiling = this.options.startProfiling;
  this.dependencies = {};
  this.initStatus = Constants.MODULE_NOT_INSTANTIATED;

  this.setData(data);
}


Module.prototype._normalizeProviderDesc = function(provides) {
  //Normalize provide descriptor
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
        if(_.isArray(provideDesc)) {
          normProvides[provideName] = {
            after: provideDesc
          };
        } else {
          var after = _.isArray(provideDesc.after) ? provideDesc.after :
          (provideDesc.after ? [provideDesc.after] : null);
          var before = _.isArray(provideDesc.before) ? provideDesc.before :
          (provideDesc.before ? [provideDesc.before] : null);
          normProvides[provideName] =  {
            after: after,
            before: before
          };
        }
      });
    }
  }
  return normProvides;
};



Module.prototype._normalizeDescriptor = function(rawModule, descriptor) {
  var self = this;
  descriptor = _.isObject(descriptor) ? _.clone(descriptor) : {};

  descriptor.provides = self._normalizeProviderDesc(descriptor.provides);

  //normalizes boostrap options
  if(!descriptor.type) {
    if(_.isFunction(rawModule)) {
      if(_.isEmpty(rawModule.prototype)) {
        descriptor.type = "factory";
      } else {
        descriptor.type = "constructor";
      }
    } else {
      descriptor.type = "object";
    }
  }

  //normalizes initialize
  if(descriptor.initialize) {
    if(_.isString(descriptor.initialize) || _.isFunction(descriptor.initialize)) {
      descriptor.initialize = [[], descriptor.initialize];
    }
  }

  return descriptor;
};


/**
 *
 * @param data
 */
Module.prototype.setData = function(data) {
  _.extend(this, _.pick(data,
    'rawModule', 'initializePromise',
    'instance', 'initStatus'
  ));
  if(data.descriptor || !this.descriptor) {
    this.descriptor = this._normalizeDescriptor(this.rawModule, data.descriptor);
  }
};


Module.prototype.getProvidesDescriptor = function(serviceName) {
  return this.descriptor.provides[serviceName];
};

Module.prototype.getInstance = function() {
  return this.instance;
};

/**
 *
 * @returns {*}
 */
Module.prototype.instantiate = function() {
  var self = this;
  if(self.instancePromise) {
    return self.instancePromise;
  }
  
  if(self.descriptor.isStateful && !self.isStateful) {
    //do not bootstrap dynamic modules
    self.setData({
      instance: null,
      instancePromise: Promises.resolve(null)
    });
    return Promises.resolve(self);
  }
  self.log('verbose', "Instantiating module " + self.name);

  var ret = null;
  var mode = self.descriptor.type;
  switch(mode) {
    case "object":
      self.log('silly', "Assigning module " + self.name);
      //just assign it
      ret = Promises.resolve(self.rawModule);
      break;
    case "constructor":
      self.log('silly', "Instantiating module " + self.name +  " from the constructor");
      ret = self.newInject(self.rawModule, self.descriptor.args);
      break;
    case "factory":
      self.log('silly', "Retrieving module " + self.name + " from the factory");
      ret = self.invokeInject(self.rawModule, self.descriptor.args, null);
      break;
    default:
      throw new Error("Unrecognized module type: " + mode);
  }

  self.instancePromise = Promises.timeout(self.options.instantiateTimeout, ret.then(function(ret) {
    self.log('verbose', "Module " + self.name + " is instantiated");
    self.setData({instance: ret, initStatus: Constants.MODULE_INSTANTIATED});
    return self;
  })).otherwise(function(err) {
    if(err.message.match(/timed out after/)) {
      throw new Error("Instantiation of module " + self.name + " timed out (possible deadlock)");
    }
    throw err;
  });

  return self.instancePromise;
};


/**
 * initialize and inject properties
 * @returns {*}
 */
Module.prototype.initialize = function() {
  var self = this;
  if(self.initializePromise) {
    return self.initializePromise;
  }
  
  if(!self.instancePromise) {
    //instantiate first
    self.instantiate();
  }
  
  var initializePromise = self.instancePromise.then(function() {
    //do we have properties to inject?
    if(!_.isEmpty(self.descriptor.properties)) {
      self.log('silly', "Injecting properties into module " + self.name + ", props: " + self.descriptor.properties);
      return self.injectProperties(self.instance, self.descriptor.properties);
    }
  }).then(function() {
    self.setData({initStatus: Constants.MODULE_INJECTED});
      
    //any initialize?
    var initialize = self.descriptor.initialize;
    if(!initialize) {
      return undefined;
    }

    var initializeFoo = initialize[1];
    if(_.isString(initializeFoo)) {
      initializeFoo = self.instance[initializeFoo];
    }
    if(_.isFunction(initializeFoo)) {
      self.log('silly', "Invoking initialize method for module " + self.name);
      return self.invokeInject(initializeFoo, initialize[0], self.instance);
    }
    return undefined;
  }).then(function() {
    self.setData({initStatus: Constants.MODULE_INITIALIZED});
    return self;
  });
  
  return self.initializePromise = Promises.timeout(self.options.initializeTimeout, initializePromise).otherwise(function(err) {
    if(err.message.match(/timed out after/)) {
      throw new Error("Initialization of module " + self.name + " timed out (possible deadlock)");
    }
    throw err;
  });
};


Module.prototype.load = function(deps) {
  return this.container.load(deps, this);
};


Module.prototype.newInject = function(constr, deps) {
  var self = this;
  //do we have arguments to inject?
  if(_.isEmpty(deps)) {
    return Promises.resolve(new constr());
  } else {
    return self.load(deps).then(function(modDeps) {
      return utils.applyConstruct(constr, modDeps);
    });
  }
};


Module.prototype.invokeInject = function(foo, deps, context) {
  var self = this;
  return self.load(deps).then(function(modDeps) {
    return foo.apply(context, modDeps);
  });
};


Module.prototype.injectProperties = function(instance, properties) {
  return this.load(properties).then(function(modDeps) {
    _.extend(instance, modDeps);
  });
};


module.exports = Module;