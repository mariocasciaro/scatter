
var expect = require('chai').expect,
  fs = require('fs'),
  rimraf = require('rimraf'),
  Scatter = require('../lib');


var TEST_DIR = __dirname + '/01-load/';


describe('Scatter basic loading', function() {
  describe("load", function() {
    var scatter;
    before(function() {
      scatter = new Scatter();
      scatter.addRoots(TEST_DIR + '/basic');
    });
  
    it('should load and return a module', function(done) {
      scatter.load('Module1').then(function(mod) {
        expect(mod).to.exist;
        expect(mod).to.have.property('prop', 'mod1');
        done();
      }).otherwise(done);
    });

    it('should load and return a module under a namespace', function(done) {
      scatter.load('namespace/Module1').then(function(mod) {
        expect(mod).to.exist;
        expect(mod).to.have.property('prop', 'namespace/mod1');
      }).then(function() {
        return scatter.load('namespace/namespace1/Module2').then(function(mod) {
          expect(mod).to.exist;
          expect(mod).to.have.property('prop', 'namespace/namespace1/mod2');
          done();
        });
      }).otherwise(done);
    });

    it('should throw an exception if module does not exists', function(done) {
      scatter.load('VOID').then(function(mod) {
        done(new Error("Exception not thrown, returned: " + mod));
      }).otherwise(function(err) {
        expect(err).to.match(/Cannot find/);
        done();
      }).otherwise(done);
    });
  });


  describe("load", function() {
    var scatter;
    before(function() {
      scatter = new Scatter();
      scatter.addRoots(TEST_DIR + '/types');
    });

    it('should not explode with a NULL module', function(done) {
      scatter.load('Null').then(function(mod) {
        done(new Error("Exception not thrown"));
      }).otherwise(function(err) {
        expect(err).to.match(/Cannot find/);
        done();
      }).otherwise(done);
    });

    it('should instantiate with a factory', function(done) {
      scatter.load('Factory').then(function(mod) {
        expect(mod).to.have.property('prop','factory');
        done();
      }).otherwise(done);
    });

    it('should instantiate with a constructor', function(done) {
      scatter.load('Constructor').then(function(mod) {
        expect(mod).to.have.property('prop','constructor');
        done();
      }).otherwise(done);
    });
    
    it('should instantiate with a constructor (heuristic)', function(done) {
      scatter.load('AutoConstructor').then(function(mod) {
        expect(mod).to.have.property('prop','autoconstructor');
        done();
      }).otherwise(done);
    });
  });


  describe("Dependency injection", function() {
    var scatter;
    before(function() {
      scatter = new Scatter({
      //  log: function(level, message) {
      //    console.log(message);
      //  }
      });
      scatter.addRoots(TEST_DIR + '/di');
    });


    it('should inject modules in factory', function(done) {
      scatter.load('modules/RequireFactory').then(function(mod) {
        expect(mod).to.have.deep.property('dep.prop', 'depObj');
        done();
      }).otherwise(done);
    });
    
    it('should inject modules in constructor', function(done) {
      scatter.load('modules/RequireConstr').then(function(mod) {
        expect(mod).to.have.deep.property('dep.prop', 'depFactory');
        done();
      }).otherwise(done);
    });
    
    it('should inject modules in properties', function(done) {
      scatter.load('modules/RequireProps').then(function(mod) {
        expect(mod).to.have.deep.property('dep.prop', 'depFactory');
        done();
      }).otherwise(done);
    });
    
    
    it('should inject modules in "initialize"', function(done) {
      scatter.load('modules/RequireOnInit').then(function(mod) {
        expect(mod).to.have.deep.property('dep.prop', 'depFactory');
        done();
      }).otherwise(done);
    });
    
    it('should inject modules in "initialize" (Normalized)', function(done) {
      scatter.load('modules/RequireOnInitNorm').then(function(mod) {
        expect(mod).to.have.deep.property('dep', 'done!');
        done();
      }).otherwise(done);
    });
    
    it('should not load a dynamic module from a static one', function(done) {
      scatter.load('modules/RequireDynamicErr').then(function(mod) {
        done(new Error("Exception not thrown"));
      }).otherwise(function(err) {
        expect(err).to.match(/Can't require a dynamic module from a static container/);
        done();
      }).otherwise(done);
    });
  });
  
  
  describe("2 base paths", function() {
    it('should form a unique namespace', function(done) {
      var scatter = new Scatter();
      scatter.addRoots( [
        TEST_DIR + '/2roots/base1',
        TEST_DIR + '/2roots/base2'
      ]);

      scatter.load('Module1').then(function(mod) {
        expect(mod).to.have.deep.property('dep.prop', 'mod2');
        done();
      }).otherwise(done);
    });
  });
  
  describe("Base paths using globs", function() {
    it('should expand globs', function(done) {
      var scatter = new Scatter();
      scatter.addRoots(TEST_DIR + '/2roots/base*');

      scatter.load('Module1').then(function(mod) {
        expect(mod).to.have.deep.property('dep.prop', 'mod2');
        done();
      }).otherwise(done);
    });
  });
  
  describe("assemble", function() {
    var scatter;
    before(function(){
      scatter = new Scatter();
      scatter.addRoots([
        TEST_DIR + '/2rootsAssemble/base1',
        TEST_DIR + '/2rootsAssemble/base2'
      ]);

      scatter.assemble();
    });

    it('should load all modules in advance', function() {
      var inspector = require(TEST_DIR + '/2rootsAssemble/inspector');
      expect(inspector).to.have.property('b1Module1' , true);
      expect(inspector).to.have.property('b2Module1' , true);
      expect(inspector).to.have.property('b2Module2' , true);
      expect(inspector).to.have.property('b2NamespaceModule1' , true);
    });
    
    it('should ignore excluded directories', function(done) {
      var inspector = require(__dirname + '/01-load/2rootsAssemble/inspector');
      expect(inspector).to.not.have.property('b1Module3');
      expect(inspector).to.not.have.property('b1Module4');
      scatter.load('ignored/ignorethis/Module3').then(function() {
        done(new Error("No exception thrown"));
      }).otherwise(function(err){
        expect(err).to.match(/Cannot find/);
        expect(inspector).to.not.have.property('b1Module3');
        expect(inspector).to.not.have.property('b1Module4');
        done();
      }).otherwise(done);
    });
  });
  
  
  describe("scoped assemble", function() {
    it('should load only matching modules in advance', function() {
      var scatter = new Scatter();
      scatter.addRoots([
        TEST_DIR + '/2rootsScopedAssemble/base1',
        TEST_DIR + '/2rootsScopedAssemble/base2'
      ]);
      scatter.assemble("namespace");
      
      var inspector = require(TEST_DIR + '/2rootsScopedAssemble/inspector');
      expect(inspector).to.not.have.property('b1Module1');
      expect(inspector).to.not.have.property('b2Module1');
      expect(inspector).to.not.have.property('b2Module2');
      expect(inspector).to.have.property('b2NamespaceModule1' , true);
    });
  });


  describe("autoresolver", function() {
    it('should discover all roots in appDir', function(done) {
      var scatter = new Scatter();
      scatter.discoverRoots(TEST_DIR + '/2rootsAutodiscover');

      scatter.load('Module1').then(function(mod) {
        expect(mod).to.have.deep.property('dep.prop', 'mod2');
        done();
      }).otherwise(done);
    });

    it('should discover npm modules', function(done) {
      var scatter = new Scatter();
      scatter.discoverRoots(TEST_DIR + '/2rootsAutodiscover');
      scatter.setNodeModulesDir(__dirname + "/../node_modules");

      scatter.load('npm!lodash').then(function(mod) {
        expect(mod).to.exist;
        expect(mod.VERSION).to.be.equal(require('lodash').VERSION);
      }).then(function() {
        return scatter.load('Module1').then(function(mod) {
          expect(mod).to.have.deep.property('dep.prop', 'mod2');
          done();
        });
      }).otherwise(done);
    });
    
    it('should discover modules under node_modules', function(done) {
      var scatter = new Scatter();
      scatter.setNodeModulesDir(TEST_DIR + '/2rootsAutodiscover');

      scatter.load('Module1').then(function(mod) {
        expect(mod).to.have.deep.property('dep.prop', 'mod2');
        done();
      }).otherwise(done);
    });
    
    it('should discover roots under symlinked dirs', function(done) {
      var scatter = new Scatter();
      var link = TEST_DIR + "/2rootsAutodiscoverLink/base2";
      try {
        rimraf.sync(link);
        //if it still exists, it means it
      } catch(err) {
        console.log(err);
        //nothing here, this workaround is just for problem with invalid symlinks
      }
      fs.symlinkSync(TEST_DIR + "/2rootsAutodiscover/base2", link);
      
      scatter.setNodeModulesDir(TEST_DIR + '/2rootsAutodiscoverLink');

      scatter.load('Module1').then(function(mod) {
        expect(mod).to.have.deep.property('dep.prop', 'mod2');
        done();
      }).otherwise(done);
    });

    it('should redefine new roots in package.json', function(done) {
      var scatter = new Scatter();
      scatter.addRoots(TEST_DIR + '/packageMultiRoots');

      scatter.load('Module1').then(function(mod) {
        expect(mod).to.have.deep.property('dep.prop', 'mod2');
        done();
      }).otherwise(done);
    });
  });
});
