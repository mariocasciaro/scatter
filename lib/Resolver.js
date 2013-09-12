var _ = require('lodash'),
  path = require('path'),
  glob = require('glob'),
  minimatch = require('minimatch'),
  fs = require('fs');


var SCATTER_FILE_NAME = 'scatter.json';
var DEFAULT_EXCLUDE = ['.git', 'node_modules', '.svn'];


function Resolver(options) {
  this.roots = [];
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
Resolver.prototype.registerComponents = function(componentsPaths, basePath) {
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
    if(!descriptor.subcomponents && !descriptor.name) {
      throw new Error("Component `name` or `subcomponents` required in " + descriptorFileName);
    }

    if(_.isArray(descriptor.subcomponents)) {
      self.registerComponents(descriptor.subcomponents, componentPath);
    } else {
      //use the package directory
      self.roots.push({
        root: componentPath,
        descriptor: descriptor
      });
    }
  });
};

/**
 * Set the node_modules dir so it npm modules can be required with npm! and
 * scan the modules to find scatter components
 *
 * @param nodeModulesDir
 */
Resolver.prototype.setNodeModulesDir = function(nodeModulesDir) {
  var self = this;
  this.nodeModulesDir = nodeModulesDir;

  //Look into package.json and extract the scatter exports
  var packages = self._expandPaths(path.join(nodeModulesDir, "*"));
  self.registerComponents(packages);
};


Resolver.prototype.isIgnored = function(rootObj, file) {
  var ignores = rootObj.descriptor.exclude || [];
  ignores = ignores.concat(DEFAULT_EXCLUDE);
  
  return _.any(ignores, function(ignore) {
    return minimatch(file, ignore);
  });
};

/**
 * Resolves a single module
 *
 * @param name
 * @returns {*}
 */
Resolver.prototype.resolveModule = function(name) {
  var self = this;
  var mod;
  _.some(self.roots, function(rootObj) {
    var filename = name + '.js';
    var fullpath = path.join(rootObj.root, filename);
    if(!self.isIgnored(rootObj, filename) && 
      fs.existsSync(fullpath) &&
      fs.statSync(fullpath).isFile()) 
    {
      mod = require(fullpath);
      return true;
    }
    return false;
  });
  
  return mod;
};

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
    var fileName = path.basename(require(packagejson).main, '.js');
    file = path.join(self.nodeModulesDir, name, fileName+'.js');
    if(fs.existsSync(file)) {
      return require(file);
    }
  }
  
  throw new Error("Cannot find npm module '" + name + "'");
};


Resolver.prototype.resolveInRoot = function(rootObj, subpath) {
  var self = this;
  subpath = subpath || "";
  var modules = {};
  var fullPath = path.join(rootObj.root, subpath);
  
  if(!self.isIgnored(rootObj, subpath)) {
    if(fs.existsSync(fullPath)) {
      var stat = fs.statSync(fullPath);
      if(stat.isFile()) {
        if(path.extname(fullPath) === ".js") {
          var modName = subpath.substring(0, subpath.lastIndexOf('.js'));
          modules[modName] = require(fullPath);
        }
      } else if(stat.isDirectory()) {
        var files = fs.readdirSync(fullPath);
        _.each(files, function(file) {
          _.defaults(modules, self.resolveInRoot(rootObj, path.join(subpath, file)));
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
  _.each(self.roots, function(objectRoot) {
    _.defaults(modules, self.resolveInRoot(objectRoot, scope));
  });
  return modules;
};

module.exports = Resolver;
