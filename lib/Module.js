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
  this.initStatus = Constants.MODULE_NOT_INSTANTIATED;
  this.delayedDeps = {};

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

  var initialize = descriptor.initialize;
  //normalizes initialize
  if(initialize) {
    if(_.isString(initialize) || _.isFunction(initialize)) {
      descriptor.initialize = [[], initialize];
    }
  }
  
  // self.delayedDeps = {};
  // function addDep(dep) {
  //   if(self.isDelayedModuleDep(dep)) {
  //     self.delayedDeps[dep] = true;
  //   } else if(self.delayedDeps[dep]) {
  //     delete self.delayedDeps[dep];
  //   }
  // }
  
  // _.each(descriptor.args, addDep);
  // _.each(descriptor.properties, addDep);
  // if(descriptor.initialize) {
  //   _.each(descriptor.initialize[0], addDep);
  // }

  return descriptor;
};


/**
 *
 * @param data
 */
Module.prototype.setData = function(data) {
  _.extend(this, _.pick(data,
    'rawModule', 'initializePromise', 'instancePromise', 'wirePromise',
    'instance', 'initStatus', 'component', 'parent'
  ));
  if(!this.component) {
    this.component = {};
  }
  
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


Module.prototype.getParent = function() {
  return this.parent;
};

Module.prototype.setParent = function(parent) {
  this.parent = parent;
  //merge the provides
  if(!this.descriptor.overrideProvides) {
    _.defaults(this.provides, parent.provides);
  }
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
    self.log('verbose', "Initializing dynamic module template " + self.name);
    //do not bootstrap dynamic modules
    self.setData({
      instance: null,
      instancePromise: Promises.resolve(self),
      wirePromise: Promises.resolve(self),
      initializePromise: Promises.resolve(self),
      initStatus: Constants.MODULE_INITIALIZED
    });
    return Promises.resolve(self);
  }
  self.log('silly', "Instantiating module " + self.name);

  var ret = null;
  var type = self.descriptor.type;
  switch(type) {
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
      self.log('silly', "Retrieving module " + self.name + " from the factory (" + self.descriptor.args + ")");
      ret = self.invokeInject(self.rawModule, self.descriptor.args, null);
      break;
    default:
      throw new Error("Unrecognized module type: " + type);
  }

  return self.instancePromise = Promises.timeout(self.options.instantiateTimeout, ret.then(function(ret) {
    self.log('silly', "Module " + self.name + " is instantiated");
    self.setData({instance: ret, initStatus: Constants.MODULE_INSTANTIATED});
    return self;
  })).otherwise(function(err) {
    if(err.message.match(/timed out after/)) {
      throw new Error("Instantiation of module " + self.name + " timed out (possible deadlock)");
    }
    throw err;
  });
};

/**
 * initialize and inject properties. Also initializes all dependencies
 * @returns {*}
 */
Module.prototype.wire = function() {
  var self = this;
  if(self.wirePromise) {
    return self.wirePromise;
  }
  
  return self.wirePromise = self.instantiate().then(function() {
    self.log('silly', "Wiring module " + self.name);
    
    //do we have properties to inject?
    if(!_.isEmpty(self.descriptor.properties)) {
      self.log('silly', "Injecting properties into module " + self.name + ", props: " + self.descriptor.properties);
      return self.injectProperties(self.instance, self.descriptor.properties).then(function() {
        self.log('silly', "Module wired " + self.name);
        self.setData({initStatus: Constants.MODULE_WIRED});
        return self;
      });
    } else {
      self.setData({initStatus: Constants.MODULE_WIRED});
      self.log('silly', "Module wired " + self.name);
      return Promises.resolve(self);
    }
  });
};


/**
 * initialize and inject properties. Also initializes all dependencies
 * @returns {*}
 */
Module.prototype.initialize = function() {
  var self = this;
  if(self.initializePromise) {
    return self.initializePromise;
  }
  
  var initializePromise = self.wire().then(function() {
    self.log('silly', "Initializing module " + self.name);
    
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
    self.log('silly', "Module initialized " + self.name);
    return self;
  });
  
  return self.initializePromise = Promises.timeout(self.options.initializeTimeout, initializePromise).otherwise(function(err) {
    if(err.message.match(/timed out after/)) {
      throw new Error("Initialization of module " + self.name + " timed out (possible deadlock)");
    }
    throw err;
  });
};


Module.prototype.initializeTree = function() {
  var self = this;
  if(self.initializeTreePromise) {
    return self.initializeTreePromise;
  }
  
  return self.initializeTreePromise = self.initialize().then(function() {
    var deps = {};
    function addDep(dep) {
      if(self.isModuleDep(dep) && deps[dep] === void 0 && dep !== self.name && module.initStatus < Constants.MODULE_TREE_INITIALIZED) {
        deps[dep] = self.getModuleFromDep(dep).initializeTree();
      }
    }
  
    if(self.parent) {
      deps.__parent = self.parent.initializeTree();
    }
    
    _.each(self.descriptor.args, addDep);
    _.each(self.descriptor.properties, addDep);
    if(self.descriptor.initialize) {
      _.each(self.descriptor.initialize[0], addDep);
    }
    
    return Promises.allKeys(deps).then(function(results) {
      self.setData({initStatus: Constants.MODULE_TREE_INITIALIZED});
      return self;
    });
  });
};


Module.prototype.getModuleFromDep = function(name) {
  return this.container.getModuleFromDep(name, this);
};

Module.prototype.isModuleDep = function(name) {
  return this.container.isModuleDep(name);
};

Module.prototype.getModule = function(name) {
  return this.container.getModule(name, this);
};

Module.prototype.load = function(deps, initOpts) {
  return this.container.load(deps, this, initOpts);
};


Module.prototype.newInject = function(constr, deps) {
  //do we have arguments to inject?
  if(_.isEmpty(deps)) {
    return Promises.resolve(new constr());
  } else {
    return this.load(deps).then(function(modDeps) {
      return utils.applyConstruct(constr, modDeps);
    });
  }
};


Module.prototype.invokeInject = function(foo, deps, context) {
  return this.load(deps).then(function(modDeps) {
    return foo.apply(context, modDeps);
  });
};


Module.prototype.injectProperties = function(instance, properties) {
  return this.load(properties).then(function(modDeps) {
    _.extend(instance, modDeps);
  });
};


module.exports = Module;