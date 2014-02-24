![Scatter logo](https://raw2.github.com/mariocasciaro/resources/master/scatter_text_lg.png)

[![NPM version](https://badge.fury.io/js/scatter.png)](http://badge.fury.io/js/scatter)
[![Build Status](https://travis-ci.org/mariocasciaro/scatter.png)](https://travis-ci.org/mariocasciaro/scatter)
[![Coverage Status](https://coveralls.io/repos/mariocasciaro/scatter/badge.png)](https://coveralls.io/r/mariocasciaro/scatter)
[![Dependency Status](https://gemnasium.com/mariocasciaro/scatter.png)](https://gemnasium.com/mariocasciaro/scatter)

Scatter is an **Inversion of Control (IoC) container** for Node.js. Scatter allows you to split your project in **particles** (components), and then uses **Dependency Injection** and **Service locator** to link your modules together.

Applications created with Scatter are **extensible out-of-the box**. Since every dependency is "virtual", you can override and extend every module. In addition by using Scatter [Services](#services) you can provide explicit extension points to your application.

Every module created for Scatter is totally agnostic to the IoC container and **can be used even without it**. Scatter modules are POJOs (Plain Old Javascript Objects), simply objects, factories and constructors that accept their dependencies as input. The only difference from a *plain* module is that Scatter reads an annotation named `__module` to extract the information to initialize the module and inject dependencies.

-----

### [Full Guide](https://github.com/mariocasciaro/scatter/wiki/Guide) | [API docs](https://github.com/mariocasciaro/scatter/wiki/API-Documentation)

-----

## Features

* Split your project into **components (particles)** and wire  modules using **Dependency Injection**.
* Define your modules as you want: factories, constructors or plain objects. 
* Your modules do not need to know who is instantiating them or wiring them, they are totally **decoupled from Scatter and will work even without it**.
* Instantiate and initialize modules **asynchronously** (just return a promise).
* **Services framework** built on top of the IoC container (with sync and async execution)

## Examples

If you prefer to go straight to the code then take a look at some [examples](https://github.com/mariocasciaro/scatter/tree/master/examples).

## Sample usage

The directory structure below shows 3 particles (Scatter components): 
* `core` the the main application
* 2 plugins: 
  * `privateProfiles`
  * `admin`

All the 3 components define some routes. The Scatter container allows you to write each component **as if it they were all included in a single app root, as if all the sources were actually contained in a single directory** (and not scattered across different components). 

In this examples `routes` is for Scatter a `namespace` not a physical directory, it is a **federated container of modules**.

```
app.js
core
|-- particle.json
|-- expressApp.js
|-- routes                <--- Routes
    |-- home.js
    `-- profiles.js
|-- data
    `-- db.js
plugins
|-- privateProfiles
    |-- particle.json
    `-- routes            <--- Routes
        |-- profiles.js   <--- an override
        `-- private.js
|-- admin
    |-- particle.json
    `-- routes            <--- Routes
        `-- admin.js
```

Now if we wanted to register all the routes in our express application, the file `core/expressApp.js.js` would look like:

```javascript
// file "core/expressApp.js.js"

var express = require('express'),
  http = require('http');

module.exports = function(homeRouter, profileRouter, privateRouter, adminRouter) {
    return {
        start: function() {
            var app = express();
            app.use(...);
            [... middleware ...]
            app.use(app.router);
            
            //now we register our routes
            homeRouter.register(app);
            profileRouter.register(app);
            privateRouter.register(app);
            adminRouter.register(app);
            
            
            http.createServer(app).listen(app.get('port'), function () {
              console.log('Express server listening on port ' + app.get('port'));
            });
        }
    };
};
//The Scatter annotation
module.exports.__module = {
    //Inject this modules are arguments
    args: ["routes/home", "routes/profiles", "routes/private", "routes/admin"]
};
```

Then at last the file `app.js` would bootstrap the Scatter container and start the express app:

```javascript
var scatter = new Scatter();
scatter.registerParticles([
  __dirname + '/plugins/*',
  __dirname + '/core'
]);

//The application entry point, the dependency is loaded explicitly
scatter.load("expressApp").then(function(expressApp) {
    expressApp.start();
});
```


## More decoupling: Services

You will notice in the example above that if a new plugins is added and a new route is introduced it will not be 
registered, because we reference directly the routes in the file `core/expressApp`. To solve this problem Scatter 
supports a pattern that is a mix between DI and service locator. 
The `svc` (Service) plugin will allow you to **require a method defined in multiple modules as a dependency**!

Using Scatter Services the `core/expressApp` would now look like:

```javascript
// file "core/expressApp.js.js"

var express = require('express'),
  http = require('http');

module.exports = function(registerAllRoutes) {
    return {
        start: function() {
            var app = express();
            app.use(...);
            [... middleware ...]
            app.use(app.router);
            
            //now we register our routes
            registerAllRoutes(app);
            
            http.createServer(app).listen(app.get('port'), function () {
              console.log('Express server listening on port ' + app.get('port'));
            });
        }
    };
};
//The Scatter annotation
module.exports.__module = {
    //Inject a service as dependency
    args: ["svc!routes/register"]
};
```

## Documentation

**There is a lot more to know!** Take a look at the guide and the API docs.

### [Full Guide](https://github.com/mariocasciaro/scatter/wiki/Guide)
### [API docs](https://github.com/mariocasciaro/scatter/wiki/API-Documentation)

## What's new

#### 0.7

* Support for relative paths in module dependencies.
* **Breaking changes**:
    * Services must now be defined using the full service namespace.
      ```
      provides: 'aService'
      ```
      Now becomes:
      ```
      provides: 'full/namespace/aService'
      ```
    * When requiring services without arguments (e.g. `svc!aService`) the `sequence` 
      service invocator will be returned instead of the full service object. 
      In practice now `svc!aService` === `svc|sequence!aService`.
    
#### 0.6

* Several internal improvement, including plugin system refactoring, new benchmarking framework, performance optimizations.
* **Breaking changes**:
  * The `log` object provided to the Scatter constructor must expect `trace, debug, info, warn, error` as levels instead of `silly, verbose, info, warn, error`.

[Full changelog](https://github.com/mariocasciaro/scatter/blob/master/CHANGES.md)

## Stability

#### 2 - Unstable

The API is in the process of settling, but has not yet had
sufficient real-world testing to be considered stable.

# Contributors

* [Mario Casciaro](https://github.com/mariocasciaro) - Twitter [@mariocasciaro](https://twitter.com/mariocasciaro) - Creator
* Zbigniew Mrowinski - Twitter [@MrowinskiZ](https://twitter.com/MrowinskiZ) - Scatter logo

-----

[![Bitdeli Badge](https://d2weczhvl823v0.cloudfront.net/mariocasciaro/scatter/trend.png)](https://bitdeli.com/free "Bitdeli Badge")
