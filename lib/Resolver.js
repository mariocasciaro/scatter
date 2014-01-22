var _ = require('lodash'),
  path = require('path'),
  glob = require('glob'),
  minimatch = require('minimatch'),
  fs = require('fs');


var SCATTER_FILE_NAME = 'particle.json';
var DEFAULT_EXCLUDE = ['**/.*', 'node_modules'];


function Resolver(options) {
  this.particles = {};
  this.particlesOrder = [];
  this.isSorted = false;

  this.log = options.log;
}

/**
 * Transforms an array of globbed paths, in an array of scattered roots
 */ 
Resolver.prototype._expandPaths = function(globs, basePath) {
  var self = this;
  if(_.isString(globs)) {
    globs = [globs];
  }

  var paths = [];
  _.each(globs, function(globbedPath) {
    if(basePath) {
      globbedPath = path.join(basePath, globbedPath);
    }
    var currentPaths = glob.sync(globbedPath);
    if(_.isEmpty(currentPaths)) {
      self.log('warn', "No particles added for " + globbedPath);
    }
    Array.prototype.push.apply(paths, currentPaths);
  });
  return paths;
};

/**
 * Add particles to the list of roots
 * @param particlesPaths
 * @param basePath [optional]
 */
Resolver.prototype.registerParticles = function(particlesPaths, basePath) {
  var self = this;
  particlesPaths = self._expandPaths(particlesPaths, basePath);

  _.each(particlesPaths, function(particlePath) {
    //check the descriptor
    var descriptorFileName = path.join(particlePath, SCATTER_FILE_NAME);
    if(!fs.existsSync(descriptorFileName)) {
      throw new Error("Scatter particle descriptor ("+SCATTER_FILE_NAME+") not found in " + particlePath);
    }
    var descriptor = require(descriptorFileName);
    if(!descriptor.subparticles && !descriptor.name) {
      throw new Error("Component `name` or `subparticles` required in " + descriptorFileName);
    }

    if(descriptor.subparticles) {
      self.registerParticles(descriptor.subparticles, particlePath);
    } else {
      self.log('info', "Registering particle at " + particlePath);
      //use the package directory
      self._addComponent(particlePath, descriptor);
      self.isSorted = false;
    }
  });
};


Resolver.prototype._addComponent = function(particlePath, descriptor) {
  var self = this;
  //normalize the descriptor
  
  //normalize exclude
  descriptor.exclude = descriptor.exclude || [];
  Array.prototype.push.apply(descriptor.exclude, DEFAULT_EXCLUDE);
  
  //to be used for grunt watch develop
  descriptor.excludeFull = _.map(descriptor.exclude, function(exclude) {
    return "!" + path.join(particlePath, exclude);
  });
  
  self.particles[descriptor.name] = {
    root: particlePath,
    descriptor: descriptor
  };
};


Resolver.prototype._sortComponents = function() {
  var self = this;
  //keep dependencies somewhere
  var dependencies = {};
  var noDependencies = [];
  //initialize deps
  _.each(self.particles, function(particle, name) {
    if(_.isEmpty(particle.descriptor.overrides)) {
      noDependencies.push(name);
    } else {
      var deps = {};
      _.each(particle.descriptor.overrides, function(dep) {
        deps[dep] = true;
      });
      dependencies[name] = deps;
    }
  });
  noDependencies = _.uniq(noDependencies);

  self.particlesOrder = [];
  while(noDependencies.length !== 0) {
    var currentName = noDependencies.shift();
    self.particlesOrder.push(currentName);
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
    self.log('warn', "There is a loop or missing requirement in the particles dependencies", dependencies);
    //add orphaned particles
    _.each(dependencies, function(deps, name) {
      self.particlesOrder.push(name);
    });
  }
  
  //It's a dependent->dependency relationship, but in our list dependent should come BEFORE the dependency!
  self.particlesOrder.reverse();
  self.isSorted = true;
};

/**
 * Set the node_modules dir so it npm modules can be required with npm! and
 * scan the modules to find scatter particles
 *
 * @param nodeModulesDir
 * @param exclude a set of modules to exclude (no glob)
 */
Resolver.prototype.setNodeModulesDir = function(nodeModulesDir, exclude) {
  var self = this;
  this.nodeModulesDir = nodeModulesDir;

  //Look into particle.json and extract the scatter exports
  var packages = self._expandPaths(path.join(nodeModulesDir, "*"))
    .filter(function(root) {
      var name = path.basename(root);
      return !_.contains(exclude, name) && fs.existsSync(path.join(root, SCATTER_FILE_NAME));
    });
  self.registerParticles(packages);
};


Resolver.prototype.isIgnored = function(rootObj, file) {
  return _.any(rootObj.descriptor.exclude, function(ignore) {
    return minimatch(file, ignore);
  });
};


Resolver.prototype.iterateParticles = function(callback) {
  var self = this;
  self.isSorted || self._sortComponents();
  _.any(self.particlesOrder, function(particlePosition) {
    return callback(self.particles[particlePosition]);
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
  self.iterateParticles(function(particle) {
    var filename = name + '.js';
    var fullpath = path.join(particle.root, filename);
    if(!self.isIgnored(particle, filename) &&
      fs.existsSync(fullpath) &&
      fs.statSync(fullpath).isFile()) 
    {
      if(!overrideFound && overrideComponent) {
        overrideFound = overrideComponent.descriptor.name === particle.descriptor.name;
      } else {
        mod = {
          rawModule: require(fullpath),
          particle: particle
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


Resolver.prototype.resolveAllInParticle = function(particle, subpath) {
  var self = this;
  subpath = subpath || "";
  var modules = {};
  var fullPath = path.join(particle.root, subpath);
  
  if(!self.isIgnored(particle, subpath)) {
    if(fs.existsSync(fullPath)) {
      var stat = fs.statSync(fullPath);
      if(stat.isFile()) {
        if(path.extname(fullPath) === ".js") {
          var modName = subpath.substring(0, subpath.lastIndexOf('.js')).replace(/\\/g, '/');
          modules[modName] = {
            rawModule: require(fullPath),
            particle: particle
          };
        }
      } else if(stat.isDirectory()) {
        var files = fs.readdirSync(fullPath);
        _.each(files, function(file) {
          _.defaults(modules, self.resolveAllInParticle(particle, path.join(subpath, file)));
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
  self.iterateParticles(function(particle) {
    _.defaults(modules, self.resolveAllInParticle(particle, scope));
  });
  return modules;
};

module.exports = Resolver;
