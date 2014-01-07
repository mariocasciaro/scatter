[![NPM version](https://badge.fury.io/js/scatter.png)](http://badge.fury.io/js/scatter)
[![Build Status](https://travis-ci.org/mariocasciaro/scatter.png)](https://travis-ci.org/mariocasciaro/scatter)
[![Coverage Status](https://coveralls.io/repos/mariocasciaro/scatter/badge.png)](https://coveralls.io/r/mariocasciaro/scatter)
[![Dependency Status](https://gemnasium.com/mariocasciaro/scatter.png)](https://gemnasium.com/mariocasciaro/scatter)

Synopsis
======

Scatter is an **Inversion of Control (IoC) container** for Node.js. Scatter allows you to split your project in **particles** (components), and then uses **Dependency Injection** and **Service locator** to link your modules together.

Applications created with Scatter are **extensible out-of-the box**. Since every dependency is "virtual", you can override and extend every module. In addition by using Scatter [Services](#services) you can provide explicit extension points to your application.

Every module created for Scatter **can be used even without the Scatter DI container**, they are just javascript objects, factories and constructors that accept their dependencies as input. The only difference from a *plain* module is that Scatter reads an annotation named `__module` to extract the information to initialize the module and inject dependencies.

-----

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

**2 - Unstable**

The API is in the process of settling, but has not yet had
sufficient real-world testing to be considered stable.


## Features

- Split your project into **components (particles)** and wire  modules using **Dependency Injection**.
- Define your modules as you want: factories, constructors or plain objects. 
- Your modules do not need to know who is instantiating them or wiring them, they are totally **decoupled from Scatter and will work even without it**.
- Instantiate and initialize modules **asynchronously** (just return a promise).
- **Services framework** built on top of the IoC container (with sync and async execution)

## Examples

If you prefer to go straight to the code then take a look at some [examples](https://github.com/mariocasciaro/scatter/tree/master/examples).

## Sample usage

####Properties injection

```javascript
// file "/componentA/say/hello.js"

var self = module.exports = {
    sayHello: function() {
        console.log("Hello " + self.world +"!");
    }
};

module.exports.__module = {
    //Inject the "world" module as a property
    properties: "world"
};
```

#### Factory injection

```javascript
// file "/componentB/saySomething.js"

//Factory initialization
var self = module.exports = function(hello) {
    return {
        saySomething: function() {
            hello();
        }
    }
};

module.exports.__module = {
    //Inject the "world" module as a property
    args: ["say/hello"]
};
```
#### Services
```javascript
var self = module.exports = function(registerRoutesSvc) {
    return {
        registerAll: function() {
            return registerRoutesSvc().then(function() {
                console.log("All routes registered");
            });
        }
    }
};

module.exports.__module = {
    //Inject a service as dependency!
    args: ["svc|sequence!routes/register"]
};
```

## Documentation

### [Guide](https://github.com/mariocasciaro/scatter/wiki/Guide)
### [API docs](https://github.com/mariocasciaro/scatter/wiki/API-Documentation)

# Credits

* [Mario Casciaro](https://github.com/mariocasciaro) - Twitter [@mariocasciaro](https://twitter.com/mariocasciaro)
* [Your name here]

-----

[![Bitdeli Badge](https://d2weczhvl823v0.cloudfront.net/mariocasciaro/scatter/trend.png)](https://bitdeli.com/free "Bitdeli Badge")
