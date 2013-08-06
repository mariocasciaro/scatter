var _ = require('lodash'),
  path = require('path'),
  glob = require('glob'),
  minimatch = require('minimatch'),
  fs = require('fs');


var SCATTER_FILE_NAME = 'package.json';
var SCATTER_PACKAGE_DESCRIPTOR = 'scatter';
var DEFAULT_IGNORE = ['.git', 'node_modules', '.svn'];


function Resolver(options) {
  this.roots = this.expandPaths(options.roots);
  this.appRoot = options.appRoot;
  if(this.appRoot) {
    //app roots
    Array.prototype.push.apply(this.roots, this.discoverRoots(this.appRoot));
    this.nodeModulesRoot = options.nodeModulesRoot || path.join(options.appRoot, 'node_modules');
  }

  if(this.nodeModulesRoot) {
    //add npm roots
    Array.prototype.push.apply(this.roots, this.discoverRoots(path.join(this.nodeModulesRoot)));
  }

  this.roots = _.uniq(this.roots, 'root');
}
  
/**
 * Transforms an array of globbed paths, in an array of scattered roots
 * (with descriptor)
 */ 
Resolver.prototype.expandPaths = function(globs, basePath) {
  var self = this;
  var roots = [];
  _.each(globs, function(globbedPath) {
    if(basePath) {
      globbedPath = path.join(basePath, globbedPath);
    }
    var expandedPaths = glob.sync(globbedPath);
    _.each( expandedPaths, function(possibleRoot) {
      var currentRoots = self._parseRoot(possibleRoot, true);
      if(currentRoots) {
        Array.prototype.push.apply(roots, currentRoots);
      }
    });
  });
  return roots;
};


Resolver.prototype._parseRoot = function(possibleRoot, ignoreMissingDescriptor) {
  var descFile = path.join(possibleRoot, SCATTER_FILE_NAME);
  if(fs.existsSync(descFile)) {
    var desc = require(descFile)[SCATTER_PACKAGE_DESCRIPTOR];
    if(desc) {
      //extract roots from descriptor
      var roots = desc.roots;
      if(roots) {
        return this.expandPaths(roots, possibleRoot);
      } else {
        return [{
          root: possibleRoot,
          descriptor: desc
        }];
      }
    }
  }
  
  if(ignoreMissingDescriptor) {
    return [{
      root: possibleRoot,
      descriptor: {}
    }];
  }
  
  return null;
};


Resolver.prototype.discoverRoots = function(possibleRoot) {
  var self = this;
  var discoveredRoots = [];

  if(!fs.existsSync(possibleRoot)) {
    return discoveredRoots;
  }
  
  var roots = self._parseRoot(possibleRoot);
  if(roots) {
    Array.prototype.push.apply(discoveredRoots, roots);
    return discoveredRoots;
  }
  
  var files = fs.readdirSync(possibleRoot);
  _.each(files, function(file) {
    var fullpath = path.join(possibleRoot, file);
    var stat = fs.lstatSync(fullpath);
    if(stat.isDirectory()) {
      //scan into directory
      Array.prototype.push.apply(discoveredRoots, self.discoverRoots(fullpath));
    }
  });
  
  return discoveredRoots;
};


Resolver.prototype.isIgnored = function(rootObj, file) {
  var ignores = rootObj.descriptor.ignore || [];
  ignores = ignores.concat(DEFAULT_IGNORE);
  
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
    var fullpath = path.join(rootObj.root, name + '.js');
    if(!self.isIgnored(rootObj, fullpath) && 
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
  var file = path.join(self.nodeModulesRoot, name + '.js');
  if(fs.existsSync(file)) {
    return require(file);
  }
  file = path.join(self.nodeModulesRoot, name, 'index.js');
  if(fs.existsSync(file)) {
    return require(file);
  }
  var packagejson = path.join(self.nodeModulesRoot, name, 'package.json');
  if(fs.existsSync(packagejson)) {
    var fileName = path.basename(require(packagejson).main, '.js');
    file = path.join(self.nodeModulesRoot, name, fileName+'.js');
    if(path.existsSync(file)) {
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
      var stat = fs.lstatSync(fullPath);
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

