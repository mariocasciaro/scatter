
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
      scatter.registerParticles(TEST_DIR + '/basic');
    });
  
    it('should load and return a module', function(done) {
      scatter.load('Module1').then(function(mod) {
        expect(mod).to.exist;
        expect(mod).to.have.property('prop', 'mod1');
        done();
      }).catch(done);
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
      }).catch(done);
    });

    it('should throw an exception if module does not exists', function(done) {
      scatter.load('VOID').then(function(mod) {
        done(new Error("Exception not thrown, returned: " + mod));
      }).catch(function(err) {
        expect(err).to.match(/Cannot find/);
        done();
      }).catch(done);
    });
  });


  describe("load", function() {
    var scatter;
    before(function() {
      scatter = new Scatter();
      scatter.registerParticles(TEST_DIR + '/types');
    });

    it('should not explode with a NULL module', function(done) {
      scatter.load('Null').then(function(mod) {
        done(new Error("Exception not thrown"));
      }).catch(function(err) {
        expect(err).to.match(/Cannot find/);
        done();
      }).catch(done);
    });

    it('should instantiate with a factory', function(done) {
      scatter.load('Factory').then(function(mod) {
        expect(mod).to.have.property('prop','factory');
        done();
      }).catch(done);
    });

    it('should instantiate with a constructor', function(done) {
      scatter.load('Constructor').then(function(mod) {
        expect(mod).to.have.property('prop','constructor');
        done();
      }).catch(done);
    });
    
    it('should instantiate with a constructor (heuristic)', function(done) {
      scatter.load('AutoConstructor').then(function(mod) {
        expect(mod).to.have.property('prop','autoconstructor');
        done();
      }).catch(done);
    });
  });


  describe("Manual module registration", function() {
    var scatter;
    before(function() {
      scatter = new Scatter();
      scatter.registerParticles(TEST_DIR + '/types');
    });

    it('should return the manually registered module', function(done) {
      scatter.registerModuleInstance('thiswasanissue', {
        val: "it should be fixed"
      });
      
      scatter.load('thiswasanissue').then(function(mod) {
        expect(mod.val).equal("it should be fixed");
        done();
      }).catch(done);
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
      scatter.registerParticles(TEST_DIR + '/di');
    });


    it('should inject modules in factory', function(done) {
      scatter.load('modules/RequireFactory').then(function(mod) {
        expect(mod).to.have.deep.property('dep.prop', 'depObj');
        done();
      }).catch(done);
    });
    
    it('should inject modules in constructor', function(done) {
      scatter.load('modules/RequireConstr').then(function(mod) {
        expect(mod).to.have.deep.property('dep.prop', 'depFactory');
        done();
      }).catch(done);
    });
    
    it('should inject modules in properties', function(done) {
      scatter.load('modules/RequireProps').then(function(mod) {
        expect(mod).to.have.deep.property('dep.prop', 'depFactory');
        done();
      }).catch(done);
    });
    
    
    it('should inject modules in "initialize"', function(done) {
      scatter.load('modules/RequireOnInit').then(function(mod) {
        expect(mod).to.have.deep.property('dep.prop', 'depFactory');
        done();
      }).catch(done);
    });
    
    it('should inject modules in "initialize" (Normalized)', function(done) {
      scatter.load('modules/RequireOnInitNorm').then(function(mod) {
        expect(mod).to.have.deep.property('dep', 'done!');
        done();
      }).catch(done);
    });
    
    it('should not load a dynamic module from a static one', function(done) {
      scatter.load('modules/RequireDynamicErr').then(function(mod) {
        done(new Error("Exception not thrown"));
      }).catch(function(err) {
        expect(err).to.match(/Can't require a dynamic module from a static container/);
        done();
      }).catch(done);
    });
  });
  
  
  describe("Relative dependencies", function() {
    var scatter;
    before(function() {
      scatter = new Scatter({
      //  log: function(level, message) {
      //    console.log(message);
      //  }
      });
      scatter.registerParticles(TEST_DIR + '/relative');
    });


    it('should inject relative dependencies', function(done) {
      scatter.load('namespace/Module').then(function(mod) {
        expect(mod).to.have.deep.property('mod1.prop', 'Module1');
        expect(mod).to.have.deep.property('mod2.prop', 'Module2');
        expect(mod).to.have.deep.property('mod3.prop', 'Module3');
        done();
      }).catch(done);
    });
  });
  
  
  describe("Multiple components", function() {
    it('should form a unique namespace', function(done) {
      var scatter = new Scatter();
      scatter.registerParticles( [
        TEST_DIR + '/2roots/base1',
        TEST_DIR + '/2roots/base2'
      ]);

      scatter.load('Module2').then(function(mod) {
        expect(mod).to.have.deep.property('prop', 'mod2');
        done();
      }).catch(done);
    });


    it('should override modules based on particle.json settings', function(done) {
      var scatter = new Scatter();
      scatter.registerParticles( [
        TEST_DIR + '/2roots/base1',
        TEST_DIR + '/2roots/base2'
      ]);

      scatter.load('Module1').then(function(mod) {
        expect(mod).to.have.deep.property('dep.prop', 'mod2');
        done();
      }).catch(done);
    });
    
    
    it('should extend modules', function(done) {
      var scatter = new Scatter();
      scatter.registerParticles( [
        TEST_DIR + '/extension/*'
      ]);

      scatter.load('Module1').then(function(mod) {
        expect(mod).to.have.deep.property('prop', 'comp1');
        expect(mod).to.have.deep.property('parent.prop', 'comp3');
        expect(mod).to.have.deep.property('parent.parent.prop', 'comp2');
        done();
      }).catch(done);
    });

    it('should include subparticles from particle.json', function(done) {
      var scatter = new Scatter();
      scatter.registerParticles(TEST_DIR + '/subparticles');

      scatter.load('Module1').then(function(mod) {
        expect(mod).to.have.deep.property('dep.prop', 'mod2');
        done();
      }).catch(done);
    });

    it('should expand globs', function(done) {
      var scatter = new Scatter();
      scatter.registerParticles(TEST_DIR + '/2roots/base*');

      scatter.load('Module1').then(function(mod) {
        expect(mod).to.have.deep.property('dep.prop', 'mod2');
        done();
      }).catch(done);
    });
  });

  
  describe("assemble", function() {
    var scatter;
    before(function(){
      scatter = new Scatter();
      scatter.registerParticles([
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
      }).catch(function(err){
        expect(err).to.match(/Cannot find/);
        expect(inspector).to.not.have.property('b1Module3');
        expect(inspector).to.not.have.property('b1Module4');
        done();
      }).catch(done);
    });
  });
  
  
  describe("scoped assemble", function() {
    it('should load only matching modules in advance', function() {
      var scatter = new Scatter();
      scatter.registerParticles([
        TEST_DIR + '/2rootsScopedAssemble/base1',
        TEST_DIR + '/2rootsScopedAssemble/base2'
      ]);
      var modules = scatter.assemble("namespace");
      expect(modules).to.have.keys('namespace/Module1');
      
      var inspector = require(TEST_DIR + '/2rootsScopedAssemble/inspector');
      expect(inspector).to.not.have.property('b1Module1');
      expect(inspector).to.not.have.property('b2Module1');
      expect(inspector).to.not.have.property('b2Module2');
      expect(inspector).to.have.property('b2NamespaceModule1' , true);
    });

    it('should load only matching modules in advance (with caching)', function() {
      var scatter = new Scatter();
      scatter.registerParticles([
        TEST_DIR + '/2rootsScopedAssemble/base1',
        TEST_DIR + '/2rootsScopedAssemble/base2'
      ]);
      scatter.assemble("namespace");
      var modules = scatter.assemble("namespace");
      expect(modules).to.have.keys('namespace/Module1');

      var inspector = require(TEST_DIR + '/2rootsScopedAssemble/inspector');
      expect(inspector).to.not.have.property('b1Module1');
      expect(inspector).to.not.have.property('b2Module1');
      expect(inspector).to.not.have.property('b2Module2');
      expect(inspector).to.have.property('b2NamespaceModule1' , true);
    });


    it('should load assemble all (with caching)', function() {
      var scatter = new Scatter();
      scatter.registerParticles([
        TEST_DIR + '/2rootsScopedAssemble/base1',
        TEST_DIR + '/2rootsScopedAssemble/base2'
      ]);
      scatter.assemble();
      var modules = scatter.assemble();
      expect(modules).to.have.keys('namespace/Module1', 'Module1', 'Module2');
    });
  });


  describe("npm dir loading", function() {
    it('should load npm modules', function(done) {
      var scatter = new Scatter();
      scatter.setNodeModulesDir(__dirname + "/../node_modules");

      scatter.load('npm!lodash').then(function(mod) {
        expect(mod).to.exist;
        expect(mod.VERSION).to.be.equal(require('lodash').VERSION);
      }).then(function() {
        done();
      }).catch(done);
    });
    
    it('should discover modules under node_modules', function(done) {
      var scatter = new Scatter();
      scatter.setNodeModulesDir(TEST_DIR + '/nodeModules');

      scatter.load('Module1').then(function(mod) {
        expect(mod).to.have.deep.property('dep.prop', 'mod2');
        done();
      }).catch(done);
    });
    
    if(process.platform !== "win32") {
      it('should discover roots under symlinked dirs', function(done) {
        var scatter = new Scatter();
        var link = TEST_DIR + "/nodeModulesLink/base2";
        try {
          rimraf.sync(link);
          //if it still exists, it means it
        } catch(err) {
          console.log(err);
          //nothing here, this workaround is just for problem with invalid symlinks
        }
        fs.symlinkSync(TEST_DIR + "/nodeModules/base2", link);
        
        scatter.setNodeModulesDir(TEST_DIR + '/nodeModulesLink');

        scatter.load('Module1').then(function(mod) {
          expect(mod).to.have.deep.property('dep.prop', 'mod2');
          done();
        }).catch(done);
      });
    }
  });
});
