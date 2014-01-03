var _ = require('lodash'),
  Promises = require('./../../promises'),
  path = require('path'),
  CONSTANTS = require('./../../constants'),
  util = require('util'),
  async = require('async'),
  minimatch = require('minimatch');


function Service(container, name, fromModule) {
  this.container = container;
  
  this.modulesCache = null;
  this.scope = name.lastIndexOf("/") === -1 ? "" : path.dirname(name);
  this.serviceName = name;
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
  self.log('debug', "Invoking service " + self.serviceName + ", resolving modules..");

  //check if we have a pre-configured order
  if(self.modulesCache) {
    return self._invokeWithModules(args, options, self.modulesCache);
  } else {
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
  var modules = self.container.assemble(self.scope);
  
  var mods = [];
  _.each(modules, function(mod, moduleName) {
    if(mod.annotations.isStateful && !self.container.isStateful) {
      return undefined;
    }
    
    if(mod.annotations.provides[self.serviceName]) {
      mods.push(moduleName);
    }
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

  self.log('debug', "Invoking service " + self.serviceName + " over modules " + util.inspect(_.pluck(modules, 'name')));

  var deferred = Promises.defer();
  
  var prevRes = initialInput;
  var mod;
  var idx = 0;
  var finish = false;
  async.whilst(
    function() {
      mod = modules[idx];
      return idx < modules.length && !finish;
    },
    function(done) {
      try {
        idx++;
        self.log('debug', "Invoking service " + self.serviceName + " over module " + mod.name);
        var argsToUse = args;
        if(options.chained) {
          argsToUse = [prevRes];
        }
        var instance = mod.getInstance();
        var handler = mod.annotations.provides[self.serviceName].handler;
        if(!handler) {
          //use default
          handler = path.basename(self.serviceName);
        }
        var service = instance[handler];
        if(!instance || !_.isFunction(service)) {
          throw new Error("Can't find service handler '" + handler + "' into module " + mod.name);
        }
        
        var res = service.apply(instance, argsToUse);
        if(!Promises.isPromiseLike(res)) {
          setResult(res);
        } else {
          res.then(function(res) {
            setResult(res);
          }).catch(done);
        }
      } catch(err) {
        done(err);
      }
      
      function setResult(res) {
        if(options.chained || options.oneResult) {
          prevRes = res;
          finish = prevRes !== void 0 && options.oneResult;
          done();
        } else {
          results.push(res);
          done();
        }
      }
    }, function(err, res) {
      if(err) {
        self.log('error', "There was an error while invoking service " + self.serviceName +
          " over module: " + mod.name + ".\n" + err.stack);
        deferred.reject(err);
      } else {
        self.log('trace', "All services " + self.serviceName + " were invoked");
        if(options.chained || options.oneResult) {
          deferred.resolve(prevRes);
        } else {
          deferred.resolve(results);
        }
      }
    }
  );
  
  return deferred.promise;
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
    var desc = modules[name].annotations.provides[self.serviceName];
    _.each(desc.after, function(dep) {
      var matched = minimatch.match(providerModules, dep, {});
      _.each(matched, function(match) {
        if(match !== name) {
          if(_.contains(dependencies[match] ,name)) {
            self.log('info', "There is a dependency loop between services from '" + name + "' and '" + match + "'");
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
            self.log('info', "There is a dependency loop between services from '" + match+ "' and '" + name + "'");
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
