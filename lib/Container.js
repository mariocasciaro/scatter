var _ = require('lodash'),
  Promises = require('./promises'),
  Module = require('./Module'),
  CONSTANTS = require('./constants'),
  path = require('path'),
  util = require('util'),
  minimatch = require('minimatch'),
  Provider = require('./Provider');

/**
 *
 * @param resolver
 * @param options
 * @constructor
 */
function Container(resolver, options) {
  this.options = options;
  this.modules = {};
  this.providers = {};
  this.resolver = resolver;

  this.log = this.options.log;
  this.startProfiling = this.options.startProfiling;
  this.npmRequire = this.options.npmRequire;
}


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
    descriptor = rawMod.__scattered ? rawMod.__scattered : descriptor;
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
    descriptor: rawInstance.__scattered
  });
  this.setModule(name, mod);
  return mod;
};


Container.prototype.resolveAll = function(scope) {
  return this.resolver.resolveAll(scope);
};


/**
 *
 * @param name
 * @param fromModule
 * @returns {*}
 */
Container.prototype.loadModule = function(name, fromModule) {
  var self = this;
  self.log('silly', "Loading module " + name);
  var mod = self.modules[name];
  if(mod === void 0) {
    mod = self.resolveModule(name);
  }
  
  var retPromise = null;
  //if loaded from another module, let's check the status
  if(fromModule) {
    if(fromModule.initStatus < CONSTANTS.MODULE_INJECTED) {
      //phase 1 (factory/constr or prop inject), return only instance
      retPromise = mod.instantiate();
    } else {
      //phase 2 (svc inject, initialize, dynamic load), return full instance
      retPromise = mod.initialize();
    }
  } else {
    //outside of any module, return full instance
    retPromise = mod.initialize();
  }
  
  return Promises.timeout(self.options.loadTimeout, retPromise).otherwise(function(err) {
    if(err.message.match(/timed out after/)) {
      var fromModuleName = fromModule ? fromModule.name : 'GLOBAL';
      throw new Error("Loading of module " + name + " from module "+ fromModuleName + 
        " timed out (possible deadlock)");
    }
    throw err;
  });
};


/**
 *
 * @param name
 * @param fromModule
 * @returns {*}
 * @private
 */
Container.prototype._loadOne = function(name, fromModule) {
  var self = this;
  return Promises.when(null, function() {
    if(name.lastIndexOf(CONSTANTS.PROVIDER_IDENTIFIER, 0) === 0) {
      //a provider was requested
      var providerName = name.substr(CONSTANTS.PROVIDER_IDENTIFIER_LENGTH);
      return self.getProvider(providerName, fromModule);
    } if(name.lastIndexOf(CONSTANTS.NPM_IDENTIFIER, 0) === 0) {
      var modName = name.substr(CONSTANTS.NPM_IDENTIFIER_LENGTH);
      return self.npmRequire(modName);
    } else if(name === CONSTANTS.CONTAINER_IDENTIFIER) {
      return fromModule;
    } else if(name.lastIndexOf(CONSTANTS.CONTEXT_IDENTIFIER, 0) === 0) {
      var propName = name.substr(CONSTANTS.CONTEXT_IDENTIFIER_LENGTH);
      return self.getContext(propName);
    } else {
      return self.loadModule(name, fromModule).then(function(mod) {
        if(mod.descriptor.isStateful && !mod.isStateful) {
          throw new Error("Can't require a dynamic module from a static container "+fromModule+" => " + name );
        }

        return mod.instance;
      });
    }
  });
};


Container.prototype.isModuleDep = function(name) {
  //TODO this looks ugly
  if(name.lastIndexOf(CONSTANTS.PROVIDER_IDENTIFIER, 0) === 0) {
    return false;
  } else if(name.lastIndexOf(CONSTANTS.NPM_IDENTIFIER, 0) === 0) {
    return false;
  } else if(name === CONSTANTS.CONTAINER_IDENTIFIER) {
    return false;
  } else if(name.lastIndexOf(CONSTANTS.CONTEXT_IDENTIFIER, 0) === 0) {
    return false;
  }

  return true;
};

/**
 *
 * @param deps
 * @param fromModule
 * @returns {*}
 */
Container.prototype.load = function(deps, fromModule) {
  var self = this;
  self.log('silly', "Resolving dependencies [" + util.inspect(deps) + "] for module '" +
    fromModule);
  if(_.isString(deps)) {
    return self._loadOne(deps, fromModule);
  }

  var promise = Promises.resolve();
  if(_.isArray(deps)) {
    var retModuleArr = [];
    _.each(deps, function(moduleName) {
      promise = promise.then(function() {
        return self._loadOne(moduleName, fromModule);
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
        return self._loadOne(moduleToLoad, fromModule);
      }).then(function(mod) {
        retModules[key] = mod;
      });
    });

    return promise.then(function() {
      return retModules;
    });
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
  return self.resolveAll(scope).then(function(allModules) {
    var modules = {};
    _.each(allModules, function(mod, name) {
      if(!self.modules[name]) {
        self.registerModule(name, mod);
      }
      modules[name] = self.modules[name];
    });
    return modules;
  });
};


/**
 *
 * @returns {*}
 */
Container.prototype.bootstrapAll = function() {
  var self = this;
  self.log('verbose', "Bootstrapping all modules");
  var prof = self.startProfiling("Bootstrapping modules");
  return self.assemble().then(function() {
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
    return promise;
  }).then(function() {
    prof.end();
    self.log('verbose', "All Modules bootstrapped");
  });
};


/**
 *
 * @param serviceName
 * @returns {*}
 */
Container.prototype.getProvider = function(serviceName, fromModule) {
  var self = this;
  self.log('silly', "Retrieving provider for service " + serviceName);

  if(! self.providers[serviceName]) {
    self.providers[serviceName] = new Provider(self, serviceName, fromModule);
  }

  return self.providers[serviceName];
};


/**
 *
 */
Container.prototype.getProviderModules = function(serviceName, isStateful) {
  var self = this;

  //TODO add cache here
  var scope = serviceName.lastIndexOf("/") === -1 ? "" : path.dirname(serviceName);
  var method = path.basename(serviceName);
  var toMatch = path.join(scope, "**");
  return self.assemble(scope).then(function() {
    var mods = [];

    _.each(self.modules, function(mod, moduleName) {
      if(mod.descriptor.isStateful && !isStateful) {
        return undefined;
      }
      _.each(mod.descriptor.provides, function(provideDesc, providedServiceName) {
        if(providedServiceName === method && minimatch(moduleName, toMatch)) {
          mods.push(moduleName);
          //interrupt cycle
          return {};
        }
      });
    });

    return mods;
  });
};


Container.prototype.newStatefulContainer = function(context) {
  //TODO Optimize?
  var StatefulContainer = require('./StatefulContainer');
  return new StatefulContainer(this, context, this.options);
};



module.exports = Container;