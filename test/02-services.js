
var expect = require('chai').expect,
  Scatter = require('../lib');


describe('Scatter Services',function(){
  describe("service and scoping", function() {
    var scatter;
    beforeEach(function() {
      scatter = new Scatter();
      scatter.registerParticles(__dirname + '/02-services/scope');
    });

    it('should load a service', function(done) {
      scatter.load('svc!simple_service').then(function(svc) {
        expect(svc).to.have.property('sequence');
        expect(svc).to.have.property('any');
        expect(svc).to.have.property('pipeline');
        done();
      }).otherwise(done);
    });

    it('should invoke all sublevels', function(done) {
      scatter.load('svc!simple_service').then(function(svc) {
        return svc.sequence().then(function(results) {
          expect(results).to.have.length('3');
          expect(results).to.contain('l1/l2/Module1');
          expect(results).to.contain('l1/Module2');
          expect(results).to.contain('Module3');
          done();
        });
      }).otherwise(done);
    });

    it('should invoke only specified scope', function(done) {
      scatter.load('svc!l1/simple_service').then(function(svc) {
        return svc.sequence().then(function(results) {
          expect(results).to.have.length('2');
          expect(results).to.contain('l1/l2/Module1');
          expect(results).to.contain('l1/Module2');
          done();
        });
      }).otherwise(done);
    });

    it('should not fail for empty scope', function(done) {
      scatter.load('svc!l0/simple_service').then(function(svc) {
        return svc.sequence().then(function(results) {
          expect(results).to.have.length('0');
          done();
        });
      }).otherwise(done);
    });
  });

  describe("order and execution modes", function() {
    var scatter;
    before(function() {
      scatter = new Scatter();
      scatter.registerParticles(__dirname + '/02-services/orderAndModes');
    });

    it('should maintain order', function(done) {
      scatter.load('svc!simple_service').then(function(svc) {
        return svc.sequence().then(function(results) {
          expect(results).to.have.length('3');
          expect(results[0]).to.be.equal('l1/Module2');
          expect(results[1]).to.be.equal('l1/l2/Module1');
          expect(results[2]).to.be.equal('Module3');
          done();
        });
      }).otherwise(done);
    });

    it('should invoke as chain', function(done) {
      scatter.load('svc!chain').then(function(svc) {
        return svc.pipeline("").then(function(result) {
          expect(result).to.be.equal('Module1Module2Module3');
          done();
        });
      }).otherwise(done);
    });

    it('should invoke for oneResult', function(done) {
      scatter.load('svc!one').then(function(svc) {
        return svc.any().then(function(result) {
          expect(result).to.be.equal('Module1');
          done();
        });
      }).otherwise(done);
    });
    
    it('should invoke specific mode with dependency options', function(done) {
      scatter.load('svc|any!one').then(function(svc) {
        return svc().then(function(result) {
          expect(result).to.be.equal('Module1');
          done();
        });
      }).otherwise(done);
    });

    it('should invoke with promises', function(done) {
      scatter.load('svc!promises').then(function(svc) {
        return svc.any().then(function(result) {
          expect(result).to.be.equal('Module1');
          done();
        });
      }).otherwise(done);
    });

    it('should propagate exceptions', function(done) {
      scatter.load('svc!exc').then(function(svc) {
        return svc.sequence().then(function(result) {
          done(new Error("Exception not thrown!"));
        });
      }).otherwise(function(err) {
        expect(err).to.match(/Catch this!/);
        done();
      }).otherwise(done);
    });
  });


  describe("Injected service", function() {
    var scatter;
    before(function() {
      scatter = new Scatter();
      scatter.registerParticles(__dirname + '/02-services/injectedService');
    });

    it('should be given as dependency', function(done) {
      scatter.load('svc!another_service').then(function(svc) {
        return svc.any().then(function(results) {
          expect(results).to.have.length('2');
          expect(results).to.contain('Module1');
          expect(results).to.contain('Module3');
          done();
        });
      }).otherwise(done);
    });
  });

  describe("2PhaseLoading", function() {
    var scatter;
    before(function() {
      scatter = new Scatter();
      scatter.registerParticles(__dirname + '/02-services/2phaseLoading');
    });

    it('should load and initialize all dependencies', function(done) {
      scatter.load('svc!service').then(function(svc) {
        return svc.any().then(function(result) {
          expect(result).to.be.equal('Module3');
          done();
        });
      }).otherwise(done);
    });
  });


  describe("Dependency loop", function() {
    var scatter;
    before(function() {
      scatter = new Scatter();
      scatter.registerParticles(__dirname + '/02-services/depLoop');
    });

    it('should preserve the order of non looping services', function(done) {
      scatter.load('svc|sequence!simple_service').then(function(svc) {
        return svc().then(function(results) {
          expect(results).to.have.length('3');
          expect(results[2]).to.be.equal('Module2');
          done();
        });
      }).otherwise(done);
    });
  });
});