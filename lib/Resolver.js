var _ = require('lodash'),
  path = require('path'),
  glob = require('glob'),
  minimatch = require('minimatch'),
  fs = require('fs');


var SCATTER_FILE_NAME = 'particle.json';
var DEFAULT_EXCLUDE = ['**/.*', 'node_modules'];


function Resolver(options) {
  this.components = {};
  this.componentsOrder = [];
  this.isSorted = false;

  this.log = options.log;
}

/**
 * Transforms an array of globbed paths, in an array of scattered roots
 */ 
Resolver.prototype._expandPaths = function(globs, basePath) {
  if(_.isString(globs)) {
    globs = [globs];
  }

  var paths = [];
  _.each(globs, function(globbedPath) {
    if(basePath) {
      globbedPath = path.join(basePath, globbedPath);
    }
    Array.prototype.push.apply(paths, glob.sync(globbedPath));
  });
  return paths;
};

/**
 * Add components to the list of roots
 * @param componentsPaths
 * @param basePath [optional]
 */
Resolver.prototype.registerParticles = function(componentsPaths, basePath) {
  var self = this;
  componentsPaths = self._expandPaths(componentsPaths, basePath);

  _.each(componentsPaths, function(componentPath) {
    //check the descriptor
    var descriptorFileName = path.join(componentPath, SCATTER_FILE_NAME);
    if(!fs.existsSync(descriptorFileName)) {
      return;
      //throw new Error("Scatter component descriptor ("+SCATTER_FILE_NAME+") not found in " + componentPath);
    }
    var descriptor = require(descriptorFileName);
    if(!descriptor.subparticles && !descriptor.name) {
      throw new Error("Component `name` or `subparticles` required in " + descriptorFileName);
    }

    if(descriptor.subparticles) {
      self.registerParticles(descriptor.subparticles, componentPath);
    } else {
      self.log('verbose', "Registering component at " + componentPath);
      //use the package directory
      self._addComponent(componentPath, descriptor);
      self.isSorted = false;
    }
  });
};


Resolver.prototype._addComponent = function(componentPath, descriptor) {
  var self = this;
  //normalize the descriptor
  
  //normalize exclude
  descriptor.exclude = descriptor.exclude || [];
  Array.prototype.push.apply(descriptor.exclude, DEFAULT_EXCLUDE);
  
  //to be used for grunt watch develop
  descriptor.excludeFull = _.map(descriptor.exclude, function(exclude) {
    return "!" + path.join(componentPath, exclude);
  });
  
  self.components[descriptor.name] = {
    root: componentPath,
    descriptor: descriptor
  };
};


Resolver.prototype._sortComponents = function() {
  var self = this;
  //keep dependencies somewhere
  var dependencies = {};
  var noDependencies = [];
  //initialize deps
  _.each(self.components, function(component, name) {
    if(_.isEmpty(component.descriptor.overrides)) {
      noDependencies.push(name);
    } else {
      var deps = {};
      _.each(component.descriptor.overrides, function(dep) {
        deps[dep] = true;
      });
      dependencies[name] = deps;
    }
  });
  noDependencies = _.uniq(noDependencies);

  self.componentsOrder = [];
  while(noDependencies.length !== 0) {
    var currentName = noDependencies.shift();
    self.componentsOrder.push(currentName);
    _.each(dependencies, function(deps, name) {
      if(deps[currentName]) {
        delete deps[currentName];
        if(_.isEmpty(deps)) {
          noDependencies.push(name);
          delete dependencies[name];
        }
      }
    });
  }

  if(!_.isEmpty(dependencies)) {
    self.log('warn', "There is a cicle or missing requirement in the components dependencies " + dependencies);
    //add orphaned components
    _.each(dependencies, function(deps, name) {
      self.componentsOrder.push(name);
    });
  }
  
  //It's a dependent->dependency relationship, but in our list dependent should come BEFORE the dependency!
  self.componentsOrder.reverse();
  self.isSorted = true;
};

/**
 * Set the node_modules dir so it npm modules can be required with npm! and
 * scan the modules to find scatter components
 *
 * @param nodeModulesDir
 * @param exclude a set of modules to exclude (no glob)
 */
Resolver.prototype.setNodeModulesDir = function(nodeModulesDir, exclude) {
  var self = this;
  this.nodeModulesDir = nodeModulesDir;

  //Look into component.json and extract the scatter exports
  var packages = self._expandPaths(path.join(nodeModulesDir, "*"));
  packages = _.filter(packages, function(root) {
    var name = path.basename(root);
    return !_.contains(exclude, name);
  });
  self.registerParticles(packages);
};


Resolver.prototype.isIgnored = function(rootObj, file) {
  return _.any(rootObj.descriptor.exclude, function(ignore) {
    return minimatch(file, ignore);
  });
};


Resolver.prototype.iterateComponents = function(callback) {
  var self = this;
  self.isSorted || self._sortComponents();
  _.any(self.componentsOrder, function(componentPosition) {
    return callback(self.components[componentPosition]);
  });
};

/**
 * Resolves a single module
 *
 * @param name
 * @returns {*}
 */
Resolver.prototype.resolveModule = function(name, overrideComponent) {
  var self = this;
  var mod;
  
  var overrideFound = false;
  self.iterateComponents(function(component) {
    var filename = name + '.js';
    var fullpath = path.join(component.root, filename);
    if(!self.isIgnored(component, filename) &&
      fs.existsSync(fullpath) &&
      fs.statSync(fullpath).isFile()) 
    {
      if(!overrideFound && overrideComponent) {
        overrideFound = overrideComponent.descriptor.name === component.descriptor.name;
      } else {
        mod = {
          rawModule: require(fullpath),
          component: component
        };
        return true;
      }
    }
  });
  
  return mod;
};

/**
 * require a module from node_modules
 *
 * @param name
 * @returns The module
 */
Resolver.prototype.requireNpm = function(name) {
  var self = this;
  var file = path.join(self.nodeModulesDir, name + '.js');
  if(fs.existsSync(file)) {
    return require(file);
  }
  file = path.join(self.nodeModulesDir, name, 'index.js');
  if(fs.existsSync(file)) {
    return require(file);
  }
  var packagejson = path.join(self.nodeModulesDir, name, 'package.json');
  if(fs.existsSync(packagejson)) {
    var main = require(packagejson).main;
    var mainName = path.join(path.dirname(main), path.basename(main, '.js'));
    file = path.join(self.nodeModulesDir, name, mainName+'.js');
    if(fs.existsSync(file)) {
      return require(file);
    }
    
    file = path.join(self.nodeModulesDir, name, mainName, 'index.js');
    if(fs.existsSync(file)) {
      return require(file);
    }
  }
  
  throw new Error("Cannot find npm module '" + name + "'");
};


Resolver.prototype.resolveAllInComponent = function(component, subpath) {
  var self = this;
  subpath = subpath || "";
  var modules = {};
  var fullPath = path.join(component.root, subpath);
  
  if(!self.isIgnored(component, subpath)) {
    if(fs.existsSync(fullPath)) {
      var stat = fs.statSync(fullPath);
      if(stat.isFile()) {
        if(path.extname(fullPath) === ".js") {
          var modName = subpath.substring(0, subpath.lastIndexOf('.js'));
          modules[modName] = {
            rawModule: require(fullPath),
            component: component
          };
        }
      } else if(stat.isDirectory()) {
        var files = fs.readdirSync(fullPath);
        _.each(files, function(file) {
          _.defaults(modules, self.resolveAllInComponent(component, path.join(subpath, file)));
        });
      }
    }
  }
  
  return modules;
};

/**
 * Resolves all modules in a namespace
 *
 * @param scope
 * @returns {*}
 */
Resolver.prototype.resolveAll = function(scope) {
  var self = this;
  scope = scope || '';
  var modules = {};
  
  //get the project's files
  self.iterateComponents(function(component) {
    _.defaults(modules, self.resolveAllInComponent(component, scope));
  });
  return modules;
};

module.exports = Resolver;
