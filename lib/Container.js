var _ = require('lodash'),
  Promises = require('./promises'),
  Module = require('./Module'),
  CONSTANTS = require('./constants'),
  path = require('path'),
  util = require('util'),
  loaders = require('./loaders'),
  minimatch = require('minimatch');

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
Container.prototype.registerModule = function(name, rawMod, descriptor) {
  if(this.modules[name]) {
    throw new Error("Duplicate module name found: " + name);
  }
  if(!descriptor) {
    descriptor = rawMod.__scatter ? rawMod.__scatter : descriptor;
  }

  var mod = this.newModule(name, {
    descriptor: descriptor,
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
Container.prototype.registerModuleInstance = function(name, instance, descriptor) {
  if(this.modules[name]) {
    throw new Error("Duplicate module name found: " + name);
  }

  var mod = this.newModule(name, {
    descriptor: descriptor,
    instance: instance,
    bootstrapped: true
  });
  mod.setData({loadingPromise: Promises.resolve(mod)});
  return mod;
};


/**
 *
 * @param name
 * @returns {*}
 * @private
 */
Container.prototype.resolveModule = function(name) {
  var mod = this.modules[name];
  if(mod !== void 0) {
    return mod;
  }

  var rawInstance = this.resolver.resolveModule(name);
  if(!rawInstance) {
    throw new Error('Cannot find module: ' + name);
  }

  mod = this.newModule(name, {
    rawModule: rawInstance,
    descriptor: rawInstance.__scatter
  });
  this.setModule(name, mod);
  return mod;
};


Container.prototype.resolveAll = function(scope) {
  return this.resolver.resolveAll(scope);
};


Container.prototype.getModule = function(name) {
  var mod = this.modules[name];
  if(mod === void 0) {
    mod = this.resolveModule(name);
  }
  return mod;
};

/**
 *
 * @param name
 * @param fromModule
 * @returns {*}
 */
Container.prototype.loadModule = function(name, fromModule, ensureInitialized) {
  var self = this;
  self.log('silly', "Loading module " + name);
  var mod = self.getModule(name);
  
  if(ensureInitialized) {
    return mod.initializeTree();
  }
  
  //phase 1 (factory/constr or prop inject), return only instance
  return mod.instantiate();
};

/**
 *
 * @param name
 * @param fromModule
 * @returns {*}
 * @private
 */
Container.prototype._loadOne = function(name, fromModule, ensureInitialized) {
  var self = this;
  
  var sepIdx = name.indexOf(CONSTANTS.LOADER_NAME_SEPARATOR);
  if(sepIdx > 0) {
    var loaderName = name.substring(0, sepIdx);
    var optionsSepIdx = loaderName.indexOf(CONSTANTS.LOADER_ARGS_SEPARATOR);
    if(optionsSepIdx > 0) {
      var loaderOptions =  loaderName.substring(optionsSepIdx + 1);
      loaderName = loaderName.substring(0, optionsSepIdx);
    }
    
    var dependencyName = name.substring(sepIdx + 1);
    if(!self.dependencyLoaders[loaderName]) {
      throw new Error("Cannot find a loader for dependency type '" + loaderName + "'");
    }
    return self.dependencyLoaders[loaderName].load(dependencyName, loaderName, 
      loaderOptions, fromModule, ensureInitialized);
  } else {
    //no loader name, just load the module with the specified name
    
    return self.loadModule(name, fromModule, ensureInitialized).then(function(mod) {
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
  var sepIdx = name.indexOf(CONSTANTS.LOADER_NAME_SEPARATOR);
  return sepIdx <= 0;
};


/**
 * 
 */ 
Container.prototype.getModuleFromDep = function(name) {
  //TODO this looks ugly
  if(this.isModuleDep(name)) {
    return this.getModule(name);
  }
  
  return null;
};


/**
 *
 * @param deps
 * @param fromModule
 * @returns {*}
 */
Container.prototype.load = function(deps, fromModule, ensureInitialized) {
  var self = this;
  var fromName = fromModule ? fromModule.name : "NONE";
  self.log('silly', "Resolving dependencies " + util.inspect(deps) + " for module " +
    fromName + " (" + (ensureInitialized ? "full)" : "instance)"));
  
  if(_.isString(deps)) {
    return Promises.resolve().then(function() {
      return self._loadOne(deps, fromModule, ensureInitialized);
    });
  } else {
    var promise = Promises.resolve();
    if(_.isArray(deps)) {
      var retModuleArr = [];
      _.each(deps, function(moduleName) {
        //TODO: use parallel?
        promise = promise.then(function() {
          return self._loadOne(moduleName, fromModule, ensureInitialized);
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
          return self._loadOne(moduleToLoad, ensureInitialized);
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
      self.registerModule(name, mod);
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
      return mod.initialize();
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