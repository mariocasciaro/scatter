var _ = require('lodash'),
  Promises = require('./promises'),
  Constants = require('./constants'),
  path = require('path'),
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
  //this.delayedDeps = {};

  this.setData(data);
}


Module.prototype.resolveDependencyName = function(dep) {
  if(this.isPlainModuleDep(dep)) {
    if(dep[0] !== "." && dep[0] !== "/") {
      //always consider a module as absolute unless specifically stated
      //otherwise
      dep = path.join("/", dep);
    }
    //Remove leading "/" or leading drive letter e.g "C:\"
    var sliceSize = process.platform === "win32" ? 3 : 1;
    return path.resolve("/", path.dirname(this.name), dep)
      .slice(sliceSize).replace(/\\/g, '/');
  }
  return dep;
};


Module.prototype._normalizeAnnotations = function(rawModule, annotations) {
  var self = this;
  annotations = _.isObject(annotations) ? _.clone(annotations) : {};
  
  //normalizes boostrap options
  if(!annotations.type) {
    if(_.isFunction(rawModule)) {
      if(_.isEmpty(rawModule.prototype)) {
        annotations.type = "factory";
      } else {
        annotations.type = "constructor";
      }
    } else {
      annotations.type = "object";
    }
  }

  var initialize = annotations.initialize;
  //normalizes initialize
  if(initialize) {
    if(_.isString(initialize) || _.isFunction(initialize)) {
      annotations.initialize = [[], initialize];
    }
  }
  
  //resolve relative dependencies
  annotations.args = _.map(annotations.args, this.resolveDependencyName, this);
  annotations.properties = _.mapValues(annotations.properties, this.resolveDependencyName, this);
  if(annotations.initialize) {
    annotations.initialize[0] = _.map(annotations.initialize[0], this.resolveDependencyName, this);
  }
  
  // self.delayedDeps = {};
  // function addDep(dep) {
  //   if(self.isDelayedModuleDep(dep)) {
  //     self.delayedDeps[dep] = true;
  //   } else if(self.delayedDeps[dep]) {
  //     delete self.delayedDeps[dep];
  //   }
  // }
  
  // _.each(annotations.args, addDep);
  // _.each(annotations.properties, addDep);
  // if(annotations.initialize) {
  //   _.each(annotations.initialize[0], addDep);
  // }

  return annotations;
};


/**
 *
 * @param data
 */
Module.prototype.setData = function(data) {
  _.extend(this, _.pick(data,
    'rawModule', 'initializePromise', 'instancePromise', 'wirePromise',
    'instance', 'initStatus', 'particle', 'parent'
  ));
  if(!this.particle) {
    this.particle = {};
  }
  
  if(data.annotations || !this.annotations) {
    this.annotations = this._normalizeAnnotations(this.rawModule, data.annotations);
    this.options.plugins.forEach(function(plugin) {
      _.isFunction(plugin.processAnnotations) && plugin.processAnnotations(this.annotations, this);
    }, this);
  }
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
  if(!this.annotations.overrideProvides) {
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
  
  if(self.annotations.isStateful && !self.isStateful) {
    self.log('debug', "Initializing dynamic module template " + self.name);
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
  self.log('trace', "Instantiating module " + self.name);

  var ret = null;
  var type = self.annotations.type;
  switch(type) {
    case "object":
      self.log('trace', "Assigning module " + self.name);
      //just assign it
      ret = Promises.resolve(self.rawModule);
      break;
    case "constructor":
      self.log('trace', "Instantiating module " + self.name +  " from the constructor");
      ret = self.newInject(self.rawModule, self.annotations.args);
      break;
    case "factory":
      self.log('trace', "Retrieving module " + self.name + " from the factory (" + self.annotations.args + ")");
      ret = self.invokeInject(self.rawModule, self.annotations.args, null);
      break;
    default:
      throw new Error("Unrecognized module type: " + type);
  }

  return self.instancePromise = Promises.timeout(self.options.instantiateTimeout, ret.then(function(ret) {
    self.log('trace', "Module " + self.name + " is instantiated");
    self.setData({instance: ret, initStatus: Constants.MODULE_INSTANTIATED});
    return self;
  })).catch(function(err) {
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
    self.log('trace', "Wiring module " + self.name);
    
    //do we have properties to inject?
    if(!_.isEmpty(self.annotations.properties)) {
      self.log('trace', "Injecting properties into module " + self.name + ", props: " + self.annotations.properties);
      return self.injectProperties(self.instance, self.annotations.properties).then(function() {
        self.log('trace', "Module wired " + self.name);
        self.setData({initStatus: Constants.MODULE_WIRED});
        return self;
      });
    } else {
      self.setData({initStatus: Constants.MODULE_WIRED});
      self.log('trace', "Module wired " + self.name);
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
    self.log('trace', "Initializing module " + self.name);
    
    //any initialize?
    var initialize = self.annotations.initialize;
    if(!initialize) {
      return undefined;
    }

    var initializeFoo = initialize[1];
    if(_.isString(initializeFoo)) {
      initializeFoo = self.instance[initializeFoo];
    }
    if(_.isFunction(initializeFoo)) {
      self.log('trace', "Invoking initialize method for module " + self.name);
      return self.invokeInject(initializeFoo, initialize[0], self.instance);
    }
    return undefined;
  }).then(function() {
    self.setData({initStatus: Constants.MODULE_INITIALIZED});
    self.log('trace', "Module initialized " + self.name);
    return self;
  });
  
  return self.initializePromise = Promises.timeout(self.options.initializeTimeout, initializePromise).catch(function(err) {
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
    
    _.each(self.annotations.args, addDep);
    _.each(self.annotations.properties, addDep);
    if(self.annotations.initialize) {
      _.each(self.annotations.initialize[0], addDep);
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

Module.prototype.isPlainModuleDep = function(name) {
  return this.container.isPlainModuleDep(name);
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
