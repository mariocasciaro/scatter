var Scatter = require('../lib'),
  Benchpress = require('benchpress');


var benchmark = new Benchpress();

var scatter, svc;
benchmark
  .add('Load module for the first time', {
    fn: function(done) {
      scatter.load('Module1').then(function() {
        done();
      });
    },
    beforeEach: function() {
      scatter = new Scatter();
      scatter.registerParticles([__dirname + "/modules"]);
    }
  })
  .add('Load module [Cached]', {
    iterations: 1000,
    fn: function(done) {
      scatter.load('Module1').then(function() {
        done();
      });
    },
    beforeAll: function() {
      scatter = new Scatter();
      scatter.registerParticles([__dirname + "/modules"]);
    }
  })
  .add('First time service invoke', {
    iterations: 30,
    beforeEach: function(done) {
      scatter = new Scatter();
      scatter.registerParticles([__dirname + "/modules"]);
      scatter.load('svc|sequence!a_service').then(function(svc2) {
        svc = svc2;
        done();
      });
    },
    fn: function(done) {
      svc().then(function() {
        done();
      });
    }
  })
  .add('First time service invoke after assemble', {
    iterations: 30,
    beforeEach: function(done) {
      scatter = new Scatter();
      scatter.registerParticles([__dirname + "/modules"]);
      scatter.load('svc|sequence!a_service').then(function(svc2) {
        svc = svc2;
        done();
      });
      scatter.assemble();
    },
    fn: function(done) {
      svc().then(function() {
        done();
      });
    }
  })
  .add('First time service invoke after initializeAll', {
    iterations: 30,
    beforeEach: function(done) {
      scatter = new Scatter();
      scatter.registerParticles([__dirname + "/modules"]);
      scatter.load('svc|sequence!a_service').then(function(svc2) {
        svc = svc2;
        done();
      });
      scatter.initializeAll();
    },
    fn: function(done) {
      svc().then(function() {
        done();
      });
    }
  })
  .add('Invoke service (cached)', {
    fn: function(done) {
      svc().then(function() {
        done();
      });
    },
    beforeAll: function(done) {
      scatter = new Scatter();
      scatter.registerParticles([__dirname + "/modules"]);
      scatter.load('svc|sequence!a_service').then(function(svc2) {
        svc = svc2;
        svc().then(function() {
          done();
        });
      });
    }
  })
  .add('First time service invoke (async)', {
    iterations: 50,
    beforeEach: function(done) {
      scatter = new Scatter();
      scatter.registerParticles([__dirname + "/modules"]);
      scatter.load('svc|sequence!a_promised_service').then(function(svc2) {
        svc = svc2;
        done();
      });
    },
    fn: function(done) {
      svc().then(function() {
        done();
      });
    }
  })
  .add('Invoke service (async) (cache)', {
    iterations: 50,
    fn: function(done) {
      svc().then(function() {
        done();
      });
    },
    beforeAll: function(done) {
      scatter = new Scatter();
      scatter.registerParticles([__dirname + "/modules"]);
      scatter.load('svc|sequence!a_promised_service').then(function(svc2) {
        svc = svc2;
        done();
      });
    }
  })
  .run();