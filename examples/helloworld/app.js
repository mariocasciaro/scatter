var Scatter = require('../../lib');



var scatter = new Scatter();
scatter.registerParticles(__dirname + '/components/*');

//After running this file as it is, uncomment the line below to test particles overriding
//scatter.registerParticles(__dirname + '/plugins/*');

scatter.load('say').then(function(say) {
  say.doSay();
});