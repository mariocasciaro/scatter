
var expect = require('chai').expect,
  Scatter = require('../lib');


describe('Scatter stateful container',function(){
  describe("load a stateful module", function() {
    var scatter = new Scatter();
    scatter.registerParticles(__dirname + '/04-stateful/oneModule');
    var dyn = scatter.newStatefulContainer({});

    it('returns a new module', function(done) {
      dyn.load('Module1').then(function(mod) {
        expect(mod).to.exist;
        expect(mod).to.have.property('thisIsDynamic', true);
        expect(mod).to.have.property('counter', 1);
        done();
      }).catch(done);
    });

    it('should not re-instantiate for same context', function(done) {
      dyn.load('Module1').then(function(mod) {
        expect(mod).to.exist;
        expect(mod).to.have.property('thisIsDynamic', true);
        expect(mod).to.have.property('counter', 1);
        done();
      }).catch(done);
    });

    it('returns a new dynamic module with a new context', function(done) {
      var dyn = scatter.newStatefulContainer({});
      dyn.load('Module1').then(function(mod) {
        expect(mod).to.exist;
        expect(mod).to.have.property('thisIsDynamic', true);
        expect(mod).to.have.property('counter', 2);
        done();
      }).catch(done);
    });
  });
  
  
  describe("Dependency injection", function() {
    var scatter = new Scatter();
    scatter.registerParticles(__dirname + '/04-stateful/di');

    var dyn = scatter.newStatefulContainer({});
    it('injects dynamic and static modules properly', function(done) {
      dyn.load('Module1').then(function(mod) {
        expect(mod).to.exist;
        expect(mod).to.have.deep.property('dep.data', 'Module2');
        expect(mod).to.have.deep.property('dep.count', 1);
        expect(mod).to.have.deep.property('staticDep.data', 'Module3');
        expect(mod).to.have.deep.property('staticDep.count', 1);
        done();
      }).catch(done);
    });

    it('injects without reloading', function(done) {
      dyn.load('Module1').then(function(mod) {
        expect(mod).to.exist;
        expect(mod).to.have.deep.property('dep.data', 'Module2');
        expect(mod).to.have.deep.property('dep.count', 1);
        expect(mod).to.have.deep.property('staticDep.data', 'Module3');
        expect(mod).to.have.deep.property('staticDep.count', 1);
        done();
      }).catch(done);
    });

    it('should not re-instantiate static modules', function(done) {
      var dyn = scatter.newStatefulContainer({});
      dyn.load('Module1').then(function(mod) {
        expect(mod).to.exist;
        expect(mod).to.have.deep.property('dep.data', 'Module2');
        expect(mod).to.have.deep.property('dep.count', 2);
        expect(mod).to.have.deep.property('staticDep.data', 'Module3');
        expect(mod).to.have.deep.property('staticDep.count', 1);
        done();
      }).catch(done);
    });
  });


  describe("Dynamic module services", function() {
    var scatter = new Scatter();
    scatter.registerParticles(__dirname + '/04-stateful/services');

    it('static provider invoke only static services', function(done) {
      scatter.load('svc!svc').then(function(svc) {
        return svc().then(function(results) {
          expect(results).to.have.length(1);
          expect(results).to.contain('Module3');
          done();
        });
      }).catch(done);
    });

    it('invoke static and dynamic services', function(done) {
      var dyn = scatter.newStatefulContainer({});
      dyn.load('svc!svc').then(function(svc) {
        return svc().then(function(results) {
          expect(results).to.have.length(3);
          expect(results).to.contain('Module3');
          expect(results).to.contain('Module2');
          expect(results).to.contain('Module1');
          done();
        });
      }).catch(done);
    });
  });


  describe("Deadlock in dynamic modules", function() {
    var scatter = new Scatter({
      initializeTimeout: 200,
      instatiateTimeout: 200
    });
    scatter.registerParticles(__dirname + '/04-stateful/deadlock');

    it('should throw and exception', function(done) {
      var dyn = scatter.newStatefulContainer({});
      dyn.load('Module1').then(function(mod) {
        done(new Error("No exception thrown"));
      }).catch(function(err) {
        expect(err).to.match(/deadlock/);
        done();
      }).catch(done);
    });
  });



  describe("Context as dependency", function() {
    var scatter = new Scatter();
    scatter.registerParticles(__dirname + '/04-stateful/context');

    it('should be valid', function(done) {
      var dyn = scatter.newStatefulContainer({data: "OK!"});
      dyn.load('Module1').then(function(mod) {
        expect(mod).to.have.deep.property('data.data', "OK!");
        done();
      }).catch(done);
    });
  });
});
