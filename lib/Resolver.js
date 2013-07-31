var _ = require('lodash'),
  path = require('path'),
  glob = require('glob'),
  readdirp = require('readdirp'),
  Promises = require('./promises'),
  fs = require('fs');

function Resolver(options) {
  this.roots = this.expandPaths(options.roots);
  this.namespaceFilters = options.namespaceFilters;
}

Resolver.prototype.expandPaths = function(globs) {
  var expandedPaths = [];
  _.each(globs, function(globbedPath) {
    expandedPaths.push.apply(expandedPaths, glob.sync(globbedPath));
  });
  return expandedPaths;
};


Resolver.prototype.resolveModule = function(name) {
  var self = this;
  var mod;
  _.some(self.roots, function(basedir) {
    var fullpath = path.join(basedir, name+'.js');
    if(fs.existsSync(fullpath)) {
      var stat = fs.statSync(fullpath);
      if(stat.isFile()) {
        mod = require(fullpath);
        return true;
      }
    }
    return false;
  });
  
  return mod;
};


Resolver.prototype.resolveAll = function(scope) {
  var self = this;
  var filters = ['!.git', '!node_modules', '!.svn'];
  if(self.namespaceFilters) {
    filters = _.union(filters, self.namespaceFilters);
  }
  
  //get the project's files
  var promises = [];
  _.each(self.roots, function(searchPath) {
    var root = path.join(searchPath, scope);
    if(fs.existsSync(root)) {
      var deferred = Promises.defer();
      var modules = {};
      readdirp({ root: root, fileFilter: '*.js', directoryFilter: filters})
      .on('warn', function (err) { 
        console.error('something went wrong when processing an entry', err); 
      })
      .on('error', function (err) { 
        deferred.reject(err); 
      })
      .on('data', function (entry) {
        var modName = path.join(scope, path.dirname(entry.path), path.basename(entry.path, '.js'));
        modules[modName] = require(entry.fullPath);
      })
      .on('end', function() {
        deferred.resolve(modules);
      });
      promises.push(deferred.promise);
    }
  });
  
  return Promises.all(promises, function(results) {
    var finalMap = {};
    _.each(results, function(modulesMap) {
      _.defaults(finalMap, modulesMap);
    });
    return finalMap;
  });
};

module.exports = Resolver;

