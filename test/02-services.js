
var expect = require('chai').expect,
  Scatter = require('../lib');


describe('Scatter Services',function(){
  describe("service and scoping", function() {
    var scatter;
    beforeEach(function() {
      scatter = new Scatter();
      scatter.registerParticles(__dirname + '/02-services/scope');
    });

    it('should invoke all sublevels', function(done) {
      scatter.load('svc!simple_service').then(function(svc) {
        return svc().then(function(results) {
          expect(results).to.have.length('3');
          expect(results).to.contain('l1/l2/Module1(gen)');
          expect(results).to.contain('l1/Module2(gen)');
          expect(results).to.contain('Module3');
          done();
        });
      }).catch(done);
    });

    it('should invoke only specified scope', function(done) {
      scatter.load('svc!l1/simple_service').then(function(svc) {
        return svc().then(function(results) {
          expect(results).to.have.length('2');
          expect(results).to.contain('l1/l2/Module1');
          expect(results).to.contain('l1/Module2');
          done();
        });
      }).catch(done);
    });

    it('should not fail for empty scope', function(done) {
      scatter.load('svc!l0/simple_service').then(function(svc) {
        return svc().then(function(results) {
          expect(results).to.have.length('0');
          done();
        });
      }).catch(done);
    });
  });

  describe("order and execution modes", function() {
    var scatter;
    beforeEach(function() {
      scatter = new Scatter();
      scatter.registerParticles(__dirname + '/02-services/orderAndModes');
    });

    it('should maintain order', function(done) {
      scatter.load('svc!simple_service').then(function(svc) {
        return svc().then(function(results) {
          expect(results).to.have.length('3');
          expect(results[0]).to.be.equal('l1/Module2');
          expect(results[1]).to.be.equal('l1/l2/Module1');
          expect(results[2]).to.be.equal('Module3');
          done();
        });
      }).catch(done);
    });

    it('should invoke as chain', function(done) {
      scatter.load('svc|pipeline!chain').then(function(svc) {
        return svc("").then(function(result) {
          expect(result).to.be.equal('Module1Module2Module3');
          done();
        });
      }).catch(done);
    });

    it('should invoke for oneResult', function(done) {
      scatter.load('svc|any!one').then(function(svc) {
        return svc().then(function(result) {
          expect(result).to.be.equal('Module1');
          done();
        });
      }).catch(done);
    });

    it('should invoke with promises', function(done) {
      scatter.load('svc|any!promises').then(function(svc) {
        return svc().then(function(result) {
          expect(result).to.be.equal('Module1');
          done();
        });
      }).catch(done);
    });

    it('should propagate exceptions', function(done) {
      scatter.load('svc|sequence!exc').then(function(svc) {
        return svc().then(function(result) {
          done(new Error("Exception not thrown!"));
        });
      }).catch(function(err) {
        expect(err).to.match(/Catch this!/);
        done();
      }).catch(done);
    });
  });


  describe("Injected service", function() {
    var scatter;
    beforeEach(function() {
      scatter = new Scatter();
      scatter.registerParticles(__dirname + '/02-services/injectedService');
    });

    it('should be given as dependency', function(done) {
      scatter.load('svc|any!another_service').then(function(svc) {
        return svc().then(function(results) {
          expect(results).to.have.length('2');
          expect(results).to.contain('Module1');
          expect(results).to.contain('Module3');
          done();
        });
      }).catch(done);
    });
  });

  describe("2PhaseLoading", function() {
    var scatter;
    beforeEach(function() {
      scatter = new Scatter();
      scatter.registerParticles(__dirname + '/02-services/2phaseLoading');
    });

    it('should load and initialize all dependencies', function(done) {
      scatter.load('svc|any!service').then(function(svc) {
        return svc().then(function(result) {
          expect(result).to.be.equal('Module3');
          done();
        });
      }).catch(done);
    });
  });


  describe("Dependency loop", function() {
    var scatter, loopDetected;
    beforeEach(function() {
      loopDetected = false;
      scatter = new Scatter({
        log: function(level, message) {
          loopDetected = loopDetected || /dependency loop/.test(message);
        }
      });
      scatter.registerParticles(__dirname + '/02-services/depLoop');
    });

    it('should preserve the order of non looping services', function(done) {
      scatter.load('svc|sequence!simple_service').then(function(svc) {
        return svc().then(function(results) {
          expect(results).to.have.length('3');
          expect(results[2]).to.be.equal('Module2');
          expect(loopDetected).to.be.true;
          done();
        });
      }).catch(done);
    });
    
    it.skip('should impose order if more specific dependency is added', function(done) {
      scatter.load('svc|sequence!simple_service2').then(function(svc) {
        return svc().then(function(results) {
          expect(results).to.have.length(4);
          expect(results[2]).to.be.equal('Module2');
          expect(results[3]).to.be.equal('Module4');
          expect(loopDetected).to.be.true;
          done();
        });
      }).catch(done);
    });
  });
});
