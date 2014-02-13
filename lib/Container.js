var _ = require('lodash'),
  Promises = require('./promises'),
  Module = require('./Module'),
  CONSTANTS = require('./constants'),
  util = require('util');

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
  
  this.namespaceTree = {};
  
  options.plugins.forEach(function(plugin) {
    _.isFunction(plugin.register) && plugin.register(this);
  }, this);
}


Container.prototype.mapLoader = function(name, loader) {
  this.dependencyLoaders[name] = loader;
};


/**
 *
 * @param name
 * @param module
 */
Container.prototype.setModule = function(name, module) {
  //set it in the right namespace too
  var node = this.namespaceTree;
  var components = _.compact(name.split("/"));
  while(components.length > 1) {
    var curr = components.shift();
    if(!node.namespaces) {
      node.namespaces = {};
    }
    if(!node.namespaces[curr]) {
      node.namespaces[curr] = {};
    }
    node = node.namespaces[curr];
  }
  
  if(!node.modules) {
    node.modules = {};
  }
  node.modules[name] = module;
  
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
 * @param annotations
 * @returns {Module}
 */
Container.prototype.registerModule = function(name, rawMod, annotations, particle) {
  if(this.modules[name]) {
    throw new Error("Duplicate module name found: " + name);
  }
  if(!annotations) {
    annotations = rawMod.__module || annotations;
  }

  var mod = this.newModule(name, {
    annotations: annotations,
    particle: particle,
    rawModule: rawMod
  });

  this.setModule(name, mod);
  return mod;
};


/**
 *
 * @param name
 * @param instance
 * @param annotations
 * @returns {Module}
 */
Container.prototype.registerModuleInstance = function(name, instance, annotations, particle) {
  if(this.modules[name]) {
    throw new Error("Duplicate module name found: " + name);
  }

  var mod = this.newModule(name, {
    annotations: annotations,
    particle: particle,
    instance: instance,
    initStatus: CONSTANTS.MODULE_TREE_INITIALIZED
  });
  
  mod.setData({
    instancePromise: Promises.resolve(mod),
    initializePromise: Promises.resolve(mod),
    initializeTreePromise: Promises.resolve(mod)
  });
  this.setModule(name, mod);
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
    
    override = fromModule.particle;
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
    particle: rawModule.particle,
    annotations: rawModule.rawModule.__module
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
  self.log('trace', "Loading module " + name);
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
      var fromModuleName = fromModule ? fromModule.name : "NO_SCOPE";
      throw new Error("["+fromModuleName+"] Cannot find a loader for dependency type '" + loaderName + "' ("+name+")");
    }
    return self.dependencyLoaders[loaderName].loadDependency(dependency, fromModule);
  } else {
    //no loader name, just load the module with the specified name
    
    return self.loadModule(name, fromModule, initOption).then(function(mod) {
      if(mod.annotations.isStateful && !mod.isStateful) {
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

Container.prototype.isPlainModuleDep = function(name) {
  return !this._parseDependency(name).loader;
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
  self.log('trace', "Resolving dependencies " + util.inspect(deps) + " for module " +
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
 * Implement caching mechanism for discovered modules
 */
Container.prototype._assemble = function(namespace, scope, fullScope) {
  var self = this;
  if(scope.length > 0) {
    if(!namespace.namespaces) {
      namespace.namespaces = {};
    }
    var part = scope.shift();
    if(!namespace.namespaces[part]) {
      namespace.namespaces[part] = {};
    }
    return self._assemble(namespace.namespaces[part], scope, fullScope);
  }

  //cached
  if(namespace && namespace.loaded) {
    var modules = {};
    _.defaults(modules, namespace.modules);
    _.each(namespace.namespaces, function(ns, name) {
      //be sure to set loaded to true, loaded is applied to the entire dir recursively
      ns.loaded = true;
      _.defaults(modules, self._assemble(ns, [], fullScope.concat(name)));
    });
    return modules;
  } else {
    //need to resolve everything
    var allModules = self.resolveAll(fullScope.join("/"));
    modules = {};
    _.each(allModules, function(mod, name) {
      if(!self.modules[name]) {
        self.registerModule(name, mod.rawModule, undefined, mod.particle);
      }
      modules[name] = self.modules[name];
    });
    namespace.loaded = true;
    return modules;
  }
};


Container.prototype.assemble = function(scope) {
  scope = scope || "";
  if(!_.isArray(scope)) {
    scope = _.compact(scope.split("/"));
  }
  return this._assemble(this.namespaceTree, scope, scope.slice());
};


/**
 *
 * @returns {*}
 */
Container.prototype.initializeAll = function() {
  var self = this;
  self.log('info', "Bootstrapping all modules");
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
    self.log('info', "All Modules bootstrapped");
  });
};


Container.prototype.newStatefulContainer = function(context) {
  //TODO Optimize?
  var StatefulContainer = require('./StatefulContainer');
  return new StatefulContainer(this, context, this.options);
};



module.exports = Container;
