var Scatter = require('../lib'),
  Benchmark = require('benchmark'),
  _ = require('lodash'),
  when = require('when'),
  module1 = require('./modules/Module1.js'),
  module2 = require('./modules/Module2.js')(module1);




var suite = new Benchmark.Suite();

var scatter;
suite.on('cycle', function(event) {
  console.log(String(event.target));
})
.on('error', function(err) {
  console.log("Error: " + err.stack);
})
.on('complete', function() {
  console.log('Completed');
})
.add('Load module', {
  fn: function(deferred) {
    scatter.load('Module1').then(function() {
      deferred.resolve();
    });
  },
  setup: function() {
    scatter = new Scatter();
    scatter.registerParticles([__dirname + "/modules"]);
  },
  defer: true
})
.add('Load module [Cached]', {
  fn: function(deferred) {
    scatter.load('Module1').then(function() {
      deferred.resolve();
    });
  },
  onStart: function() {
    scatter = new Scatter();
    scatter.registerParticles([__dirname + "/modules"]);
  },
  defer: true
})
.run({async: true});

