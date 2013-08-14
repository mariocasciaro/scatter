var _ = require('lodash'),
  Promises = require('./promises'),
  path = require('path'),
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
  self.log('silly', "Invoking service " + self.name + ", resolving modules...");

  //check if we have a pre-configured order
  var containers = self.modulesCache;
  
  if(containers) {
    return self._invokeWithModules(args, options, containers);
  } else {
    //be sure we assemble the modules first, so we can get the provider information
    var moduleList = self.container.getProviderModules(self.name, self.container.isStateful);
    
    return self._loadModules(moduleList).then(function(modules) {
      modules = self.modulesCache = self._sortProviders(modules);
      return self._invokeWithModules(args, options, modules);
    });
  }
};


Service.prototype._loadModules = function(names) {
  var self = this;
  var retModules = {};

  var promise = Promises.resolve();
  _.each(names, function(modName) {
    promise = promise.then(function() {
      return self.container.loadModule(modName, self.fromModule, true);
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

  self.log('silly', "Invoking service " + self.name);

  var promise = Promises.resolve(initialInput);
  _.each(modules, function(mod) {
    promise = promise.then(function(prevRes) {
      if(options.oneResult && prevRes !== (void 0)) {
        //till the end
        return prevRes;
      }
      self.log('silly', "Invoking service " + self.name + " over module " + mod.name);
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
          dependencies[name].push(match);
        }
      });
    });

    //reverse dependencies
    _.each(desc.before, function(inverseDep) {
      var matched = minimatch.match(providerModules, inverseDep, {});
      _.each(matched, function(match) {
        if(match !== name) {
          dependencies[match].push(name);
        }
      });
    });
  });

  //find no deps
  var noDeps = [];
  _.each(dependencies, function(deps, name) {
    if(_.isEmpty(deps)) {
      noDeps.push(name);
      delete dependencies[name];
    } else if(deps.length > 1){
      dependencies[name] = _.uniq(deps);
    }
  });


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
    self.log('warn', "There is a cicle or missing requirement in the plugins dependencies " + dependencies);
    _.each(dependencies, function(deps, name) {
      pluginsOrder.push(name);
    });
  }
  return pluginsOrder;
};

module.exports = Service;
