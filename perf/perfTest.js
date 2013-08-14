var Scatter = require('../lib'),
  _ = require('lodash'),
  when = require('when'),
  module1 = require('./modules/Module1.js'),
  module2 = require('./modules/Module2.js')(module1);

var scatter = new Scatter();
scatter.addRoots([__dirname + "/modules"]);

var ITERATIONS = 1000;
console.log('Scatter invoke performance over ' + ITERATIONS + ' samples');

var before = Date.now();

for(var i = 0; i < ITERATIONS; i++) {
  var results = [];
  results.push(module1.a_service(i));
  results.push(module2.a_service(i));
}

console.log("Plain invocation took: " + (Date.now() - before) + "ms");


before = Date.now();
var promise = when.resolve();
_.times(ITERATIONS, function(i) {
  var results = [];
  promise = promise.then(function() {
    return module1.a_service(i);
  }).then(function(res) {
    results.push(res);
    return module2.a_service(i);
  }).then(function(res) {
    results.push(res);
  });
});

promise.then(function(MainModule) {
  console.log("Promised invocation took: " + (Date.now() - before) + "ms");
  before = Date.now();

  var promise = when.resolve();
  _.times(ITERATIONS, function(i) {
    promise = promise.then(function() {
      return scatter.load('Module2');
    });
  });

  return promise.then(function() {
    console.log("Scatter static module loading: " + (Date.now() - before) + "ms");
    return scatter.load(['Module2', 'Module1']);
  });
}).then(function(MainModule) {
  before = Date.now();

  var promise = when.resolve();
  _.times(ITERATIONS, function(i) {
    promise = promise.then(function() {
      return scatter.load(['Module2', 'Module1']);
    });
  });

  return promise.then(function() {
    console.log("Scatter load modules: " + (Date.now() - before) + "ms");
  });
}).then(function() {
  return scatter.load('svc!a_service');
}).then(function(svc) {
  before = Date.now();

  var promise = when.resolve();
  _.times(ITERATIONS, function(i) {
    promise = promise.then(function() {
      return svc.sequence(i);
    });
  });

  return promise.then(function() {
    console.log("Scattered normal invocation took: " + (Date.now() - before) + "ms");
    return scatter.load('svc!a_promised_service');
  });
}).then(function(svc) {
  before = Date.now();

  var promise = when.resolve();
  _.times(ITERATIONS, function(i) {
    promise = promise.then(function() {
      return svc.sequence(i);
    });
  });

  return promise.then(function() {
    console.log("Scattered promised invocation took: " + (Date.now() - before) + "ms");
  });
}).then(function() {
  var dyn = scatter.newStatefulContainer("context");
  return dyn.load('svc!a_dyn_service');
}).then(function(svc) {
  before = Date.now();

  var promise = when.resolve();
  _.times(ITERATIONS, function(i) {
    promise = promise.then(function() {
      return svc.sequence(i);
    });
  });

  return promise.then(function() {
    console.log("Scattered dynamic service (same context): " + (Date.now() - before) + "ms");
  });
}).then(function() {
  before = Date.now();

  var promise = when.resolve();
  _.times(ITERATIONS, function(i) {
    promise = promise.then(function() {
      var dyn = scatter.newStatefulContainer("context");
      return dyn.load('svc!a_dyn_service').then(function(svc) {
        return svc.sequence(i);
      });
    });
  });

  return promise.then(function() {
    console.log("Scattered dynamic service (new context): " + (Date.now() - before) + "ms");
  });
}).otherwise(function(err) {
  console.log(err.stack);
});