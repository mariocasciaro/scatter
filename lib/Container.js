var _ = require('lodash'),
  Promises = require('./promises'),
  Module = require('./Module'),
  CONSTANTS = require('./constants'),
  util = require('util'),
  loaders = require('./loaders');

/**
 *
 * @param resolver
 * @param options
 * @constructor
 */
function Container(resolver, options) {
  this.options = options;
  this.modules = {};
  this.resolver = resolver;

  this.log = this.options.log;
  this.startProfiling = this.options.startProfiling;
  this.dependencyLoaders = {};
  
  this.registerLoader(loaders.npm);
  this.registerLoader(loaders.container);
  this.registerLoader(loaders.context);
  this.registerLoader(loaders.service);
  this.registerLoader(loaders.delayinit);
}

Container.prototype.registerLoader = function(loaderClass) {
  var loader = new loaderClass();
  loader.register(this);
};


Container.prototype.mapLoader = function(name, loader) {
  this.dependencyLoaders[name] = loader;
};


/**
 *
 * @param name
 * @param module
 */
Container.prototype.setModule = function(name, module) {
  this.modules[name] = module;
};

/**
 *
 * @param name
 * @param data
 * @returns {Module}
 */
Container.prototype.newModule = function(name, data) {
  return new Module(name, this, data, this.options);
};


/**
 *
 * @param name
 * @param rawMod
 * @param descriptor
 * @returns {Module}
 */
Container.prototype.registerModule = function(name, rawMod, descriptor, component) {
  if(this.modules[name]) {
    throw new Error("Duplicate module name found: " + name);
  }
  if(!descriptor) {
    descriptor = rawMod.__module || descriptor;
  }

  var mod = this.newModule(name, {
    descriptor: descriptor,
    component: component,
    rawModule: rawMod
  });

  this.setModule(name, mod);
  return mod;
};


/**
 *
 * @param name
 * @param instance
 * @param descriptor
 * @returns {Module}
 */
Container.prototype.registerModuleInstance = function(name, instance, descriptor, component) {
  if(this.modules[name]) {
    throw new Error("Duplicate module name found: " + name);
  }

  var mod = this.newModule(name, {
    descriptor: descriptor,
    component: component,
    instance: instance,
    bootstrapped: true,
    initStatus: CONSTANTS.MODULE_TREE_INITIALIZED
  });
  mod.setData({initializePromise: Promises.resolve(mod)});
  return mod;
};


/**
 * Resolve (finds) a module from any external repository (e.g. the filesystem)
 *
 * @param name
 * @param fromModule
 * @returns {*}
 */
Container.prototype.resolveModule = function(name, fromModule) {
  //check if there is an override
  var override, mod;
  if(fromModule && fromModule.name === name) {
    //do we have a cached version of the parent?
    if(fromModule.getParent()) {
      return fromModule.getParent();
    }
    
    override = fromModule.component;
  } else {
    mod = this.modules[name];
    if(mod !== void 0) {
      return mod;
    }
  }

  var fromModuleName = fromModule ? fromModule.name : "NO_SCOPE";
  var rawModule = this.resolver.resolveModule(name, override);
  if(!rawModule || !rawModule.rawModule) {
    throw new Error('['+fromModuleName+']'+ ' Cannot find module: ' + name);
  }
  
  mod = this.newModule(name, {
    rawModule: rawModule.rawModule,
    component: rawModule.component,
    descriptor: rawModule.rawModule.__module
  });
  
  if(override) {
    fromModule.setParent(mod);
  } else {
    this.setModule(name, mod);
  }
  
  return mod;
};


Container.prototype.resolveAll = function(scope) {
  return this.resolver.resolveAll(scope);
};


Container.prototype.getModule = function(name, fromModule) {
  return this.resolveModule(name, fromModule);
};

/**
 *
 * @param name
 * @param fromModule
 * @returns {*}
 */
Container.prototype.loadModule = function(name, fromModule, initOption) {
  var self = this;
  self.log('silly', "Loading module " + name);
  var mod = self.getModule(name, fromModule);
  
  switch(initOption) {
    case CONSTANTS.INIT_OPTION_DO_NOT_INIT:
      return mod.instantiate();
    case CONSTANTS.INIT_OPTION_INIT_TREE:
      return mod.initializeTree();
    case CONSTANTS.INIT_OPTION_INIT:
    default:
      return mod.initialize();
  }
};


Container.prototype._parseDependency = function(name) {
  var sepIdx = name.indexOf(CONSTANTS.LOADER_NAME_SEPARATOR);
  if(sepIdx > 0) {
    var loaderName = name.substring(0, sepIdx);
    var optionsSepIdx = loaderName.indexOf(CONSTANTS.LOADER_ARGS_SEPARATOR);
    var loaderOptions;
    if(optionsSepIdx > 0) {
      loaderOptions =  loaderName.substring(optionsSepIdx + 1);
      loaderName = loaderName.substring(0, optionsSepIdx);
    }
    
    var dependencyName = name.substring(sepIdx + 1);
    return {
      name: dependencyName,
      loader: loaderName,
      options: loaderOptions
    };
  }
  
  return {
    name: name
  };
};


/**
 *
 * @param name
 * @param fromModule
 * @returns {*}
 * @private
 */
Container.prototype._loadOne = function(name, fromModule, initOption) {
  var self = this;
  
  var dependency = self._parseDependency(name);
  if(dependency.loader) {
    var loaderName = dependency.loader;
    if(!self.dependencyLoaders[loaderName]) {
      throw new Error("Cannot find a loader for dependency type '" + loaderName + "'");
    }
    return self.dependencyLoaders[loaderName].load(dependency, fromModule);
  } else {
    //no loader name, just load the module with the specified name
    
    return self.loadModule(name, fromModule, initOption).then(function(mod) {
      if(mod.descriptor.isStateful && !mod.isStateful) {
        var fromName = fromModule ? fromModule.name : "NONE";
        throw new Error("Can't require a dynamic module from a static container "+fromName+" => " + name );
      }

      return mod.instance;
    });
  }
};


/**
 * Check if the given dependency is a module or something else (e.g. a service) 
 */
Container.prototype.isModuleDep = function(name) {
  var dependency = this._parseDependency(name);
  return !dependency.loader || dependency.loader === 'delayinit';
};


/**
 * 
 */ 
Container.prototype.getModuleFromDep = function(name, fromModule) {
  var dependency = this._parseDependency(name);
  if(!dependency.loader || dependency.loader === 'delayinit') {
    return this.getModule(dependency.name, fromModule);
  }
  
  return null;
};


/**
 *
 * @param deps
 * @param fromModule
 * @returns {*}
 */
Container.prototype.load = function(deps, fromModule, initOption) {
  var self = this;
  var fromName = fromModule ? fromModule.name : "NONE";
  self.log('silly', "Resolving dependencies " + util.inspect(deps) + " for module " +
    fromName);

  if(_.isString(deps)) {
    return Promises.resolve().then(function() {
      return self._loadOne(deps, fromModule, initOption);
    });
  } else {
    var promise = Promises.resolve();
    if(_.isArray(deps)) {
      var retModuleArr = [];
      _.each(deps, function(moduleName) {
        //TODO: use parallel?
        promise = promise.then(function() {
          return self._loadOne(moduleName, fromModule, initOption);
        }).then(function(mod) {
          retModuleArr.push(mod);
        });
      });

      return promise.then(function() {
        return retModuleArr;
      });
    } else {
      var retModules = {};
      _.each(deps, function(moduleName, key) {
        promise = promise.then(function() {
          var moduleToLoad = key;
          if(_.isString(moduleName)) {
            moduleToLoad = moduleName;
          }
          return self._loadOne(moduleToLoad, fromModule, initOption);
        }).then(function(mod) {
          retModules[key] = mod;
        });
      });

      return promise.then(function() {
        return retModules;
      });
    }
  }
};

/**
 *
 * @param scope
 * @returns {*}
 */
Container.prototype.assemble = function(scope) {
  var self = this;
  //TODO Add cache here
  var allModules = self.resolveAll(scope);
  var modules = {};
  _.each(allModules, function(mod, name) {
    if(!self.modules[name]) {
      self.registerModule(name, mod.rawModule, undefined, mod.component);
    }
    modules[name] = self.modules[name];
  });
  return modules;
};


/**
 *
 * @returns {*}
 */
Container.prototype.bootstrapAll = function() {
  var self = this;
  self.log('verbose', "Bootstrapping all modules");
  var prof = self.startProfiling("Bootstrapping modules");
  self.assemble();
  
  var promise = Promises.resolve();
  //sequence here, to be predictable
  _.each(self.modules, function(mod) {
    promise = promise.then(function() {
      return mod.instantiate();
    });
  });
  
  _.each(self.modules, function(mod) {
    promise = promise.then(function() {
      return mod.initializeTree();
    });
  });
  
  return promise.then(function() {
    prof.end();
    self.log('verbose', "All Modules bootstrapped");
  });
};


Container.prototype.newStatefulContainer = function(context) {
  //TODO Optimize?
  var StatefulContainer = require('./StatefulContainer');
  return new StatefulContainer(this, context, this.options);
};



module.exports = Container;