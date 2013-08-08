var _ = require('lodash'),
  path = require('path'),
  glob = require('glob'),
  minimatch = require('minimatch'),
  fs = require('fs');


var SCATTER_FILE_NAME = 'package.json';
var SCATTER_PACKAGE_DESCRIPTOR = 'scatter';
var DEFAULT_IGNORE = ['.git', 'node_modules', '.svn'];


function Resolver(options) {
  this.roots = [];
}

Resolver.prototype.configureRoots = function(config) {
// array format
//  {
//    path: "../etc/etc",
//    type: "root" || "discover" || "node_modules"
//  }
  var self = this;
  
  _.each(config, function(entry) {
    switch(entry.type) {
      case "node_modules":
        self.setNodeModulesDir(entry.path);
        break;
      case "discover": 
        self.discoverRoots(entry.path);
        break;
      case "root":
      default:
        self.addRoots(entry.path);
        break;
    }
  });
};

/**
 * Transforms an array of globbed paths, in an array of scattered roots
 * (with descriptor)
 */ 
Resolver.prototype._expandPaths = function(globs, ignoreMissingDescriptor, basePath) {
  var self = this;
  var roots = [];
  _.each(globs, function(globbedPath) {
    if(basePath) {
      globbedPath = path.join(basePath, globbedPath);
    }
    var expandedPaths = glob.sync(globbedPath);
    _.each( expandedPaths, function(possibleRoot) {
      var currentRoots = self._parseRoot(possibleRoot, ignoreMissingDescriptor);
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
        return this._expandPaths(roots, true, possibleRoot);
      } else {
        return [{
          root: possibleRoot,
          descriptor: desc
        }];
      }
    } else if(ignoreMissingDescriptor) {
      return [{
        root: possibleRoot,
        descriptor: {}
      }];
    } else {
      return null;
    }
  }
  
  if(ignoreMissingDescriptor) {
    return [{
      root: possibleRoot,
      descriptor: {}
    }];
  }
  
  return undefined;
};

Resolver.prototype.addRoots = function(roots, requireDescriptor) {
  if(_.isString(roots)) {
    roots = [roots];
  }
  Array.prototype.push.apply(this.roots, this._expandPaths(roots, !requireDescriptor));
  this.roots = _.uniq(this.roots, 'root');
};


Resolver.prototype.discoverRoots = function(possibleRoot) {
  var self = this;
  if(fs.existsSync(possibleRoot)) {
    var roots = self._parseRoot(possibleRoot);
    if(roots) {
      Array.prototype.push.apply(this.roots, roots);
    } else if(roots === void 0) {
      //if node descriptor was found at all...
      //go deeper, this prevents to walk all node_modules directory
      //structure 
      var files = fs.readdirSync(possibleRoot);
      _.each(files, function(file) {
        var fullpath = path.join(possibleRoot, file);
        var stat = fs.statSync(fullpath);
        if(stat.isDirectory()) {
          //scan into directory
          Array.prototype.push.apply(self.roots, self.discoverRoots(fullpath));
        }
      });
    }
  }
  this.roots = _.uniq(this.roots, 'root');
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

Resolver.prototype.setNodeModulesDir = function(nodeModulesDir, disableAutodiscover) {
  this.nodeModulesDir = nodeModulesDir;
  if(!disableAutodiscover) {
    this.discoverRoots(this.nodeModulesDir);
  }
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
