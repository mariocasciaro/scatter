var _ = require('lodash'),
  Promises = require('./promises'),
  path = require('path'),
  CONSTANTS = require('./constants'),
  util = require('util'),
  minimatch = require('minimatch');


function Service(container, name, fromModule) {
  this.container = container;
  
  this.modulesCache = null;
  this.scope = name.lastIndexOf("/") === -1 ? "" : path.dirname(name);
  this.serviceName = path.basename(name);
  this.name = name;
  this.fromModule = fromModule;
  
  this.log = container.log;
}

Service.prototype.sequence = function(/* varargs */) {
  var args = Array.prototype.slice.apply(arguments);
  return this._invoke(args);
};

Service.prototype.invoke = Service.prototype.sequence;

Service.prototype.pipeline = function(initial) {
  return this._invoke(initial, {chained: true});
};

Service.prototype.any = function() {
  var args = Array.prototype.slice.call(arguments);
  return this._invoke(args, {oneResult: true});
};

/**
 *
 * @param args
 * @param options
 * @returns {*}
 * @private
 */
Service.prototype._invoke = function(args, options) {
  var self = this;
  options = options || {};
  self.log('verbose', "Invoking service " + self.name + ", resolving modules...");

  //check if we have a pre-configured order
  var containers = self.modulesCache;
  
  if(containers) {
    return self._invokeWithModules(args, options, containers);
  } else {
    //be sure we assemble the modules first, so we can get the provider information
    var moduleList = self.getProviderModules();
    
    return self._loadModules(moduleList).then(function(modules) {
      modules = self.modulesCache = self._sortProviders(modules);
      return self._invokeWithModules(args, options, modules);
    });
  }
};


/**
 *
 */
Service.prototype.getProviderModules = function() {
  var self = this;

  //TODO add cache here
  var modules = self.container.assemble(self.scope);
  
  var mods = [];
  _.each(modules, function(mod, moduleName) {
    if(mod.descriptor.isStateful && !self.container.isStateful) {
      return undefined;
    }
    _.each(mod.descriptor.provides, function(provideDesc, providedServiceName) {
      if(providedServiceName === self.serviceName) {
        mods.push(moduleName);
        //interrupt cycle
        return {};
      }
    });
  });

  return mods;
};

Service.prototype._loadModules = function(names) {
  var self = this;
  var retModules = {};

  var promise = Promises.resolve();
  _.each(names, function(modName) {
    promise = promise.then(function() {
      //do not try to load the module with same name, otherwise it will retrieve the parent module
      if(self.fromModule && modName === self.fromModule.name) {
        return self.fromModule;
      }
      return self.container.loadModule(modName, self.fromModule, CONSTANTS.INIT_OPTION_INIT_TREE);
    }).then(function(mod) {
      retModules[modName] = mod;
    });
  });

  return promise.then(function() {
    return retModules;
  });
};


/**
 *
 * @param args
 * @param options
 * @param modules
 * @returns {*}
 * @private
 */
Service.prototype._invokeWithModules = function(args, options, modules) {
  var self = this;
  var initialInput;
  var results;
  if(options.chained) {
    initialInput = args;
  } else if(!options.oneResult) {
    results = [];
  }

  self.log('verbose', "Invoking service " + self.name + " over modules " + _.pluck(modules, 'name'));

  var promise = Promises.resolve(initialInput);
  _.each(modules, function(mod) {
    promise = promise.then(function(prevRes) {
      if(options.oneResult && prevRes !== (void 0)) {
        //till the end
        return prevRes;
      }
      self.log('verbose', "Invoking service " + self.name + " over module " + mod.name);
      var argsToUse = args;
      if(options.chained) {
        argsToUse = [prevRes];
      }
      var instance = mod.getInstance();
      var service = instance[self.serviceName];
      if(!instance || !_.isFunction(service)) {
        throw new Error("Can't find service '" + self.serviceName + "' into module " + mod.name);
      } else {
        return Promises.resolve(service.apply(instance, argsToUse)).then(function(res) {
          if(!options.chained && !options.oneResult) {
            results.push(res);
          } else {
            return res;
          }
        });
      }
    }).otherwise(function(err) {
      self.log('error', "There was an error while invoking service " + self.serviceName +
        " over module: " + mod.name + ".\n" + err.stack);
      throw err;
    });
  });
  
  return promise.then(function(res) {
    self.log('silly', "All services " + self.name + " were invoked");
    if(options.chained || options.oneResult) {
      return res;
    }
    return results;
  });
};


/**
 *
 * Topological Sort
 */
Service.prototype._sortProviders = function(modules) {
  var self = this;
  //keep dependencies somewhere
  var dependencies = {};
  var providerModules = _.keys(modules);
  //initialize deps
  _.each(providerModules, function(name) {
    dependencies[name] = [];
  });

  _.each(providerModules, function(name) {
    var desc = modules[name].getProvidesDescriptor(self.serviceName);
    _.each(desc.after, function(dep) {
      var matched = minimatch.match(providerModules, dep, {});
      _.each(matched, function(match) {
        if(match !== name) {
          if(_.contains(dependencies[match] ,name)) {
            self.log('info', "There is a dependency cycle between services from '" + name + "' and '" + match + "'");
          } else {
            dependencies[name].push(match);
          }
        }
      });
    });

    //reverse dependencies
    _.each(desc.before, function(inverseDep) {
      var matched = minimatch.match(providerModules, inverseDep, {});
      _.each(matched, function(match) {
        if(match !== name) {
          if(_.contains(dependencies[name], match)) {
            self.log('info', "There is a dependency cycle between services from '" + match+ "' and '" + name + "'");
          } else {
            dependencies[match].push(name);
          }
        }
      });
    });
  });

  //find no deps
  var noDeps = [];
  var yesDeps = {};
  _.each(dependencies, function(deps, name) {
    if(deps.length === 0) {
      noDeps.push(name);
    } else {
      yesDeps[name] = _.uniq(deps);
    }
  });
  dependencies = yesDeps;


  var pluginsOrder = [];
  while(noDeps.length !== 0) {
    var currentName = noDeps.shift();
    pluginsOrder.push(modules[currentName]);
    for(var name2 in dependencies) {
      if(dependencies.hasOwnProperty(name2) && _.contains(dependencies[name2], currentName)) {
        var newDependencies = _.without(dependencies[name2], currentName);
        if(newDependencies.length === 0) {
          noDeps.push(name2);
          delete dependencies[name2];
        } else {
          dependencies[name2] = newDependencies;
        }
      }
    }
  }

  if(_.keys(dependencies).length !== 0) {
    self.log('info', "There are missing service dependencies for modules " +
      util.inspect(dependencies));
    _.each(dependencies, function(dep, name) {
      pluginsOrder.push(modules[name]);
    });
  }
  return pluginsOrder;
};

module.exports = Service;
