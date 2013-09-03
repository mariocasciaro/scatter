[![NPM](https://nodei.co/npm/scatter.png)](https://nodei.co/npm/scatter/)

[![Build Status](https://travis-ci.org/mariocasciaro/scatter.png)](https://travis-ci.org/mariocasciaro/scatter)

# Scatter

Scatter allows you to split your projects in components located in **separated root directories**, and then uses **Dependency Injection** to make your code whole again.

**WARNING**: In this phase, Scatter API are subject to change frequently. Please submit your feedback and help stabilize its interface.


1. [Features](#features)
2. [Getting Started](#getting-started)
3. [Dependency Injection](#dependency-injection)
4. [Services](#services)
5. [API Docs](#api)


## Features

- Scatter your project across different directories (e.g. core + plugins)
- Support for namespaces (by default it follows the directory structure, like Java packages)
- Automatic discovery and registration of modules
- Module instantiation through factories, constructors or plain objects
- Instantiate and initialize modules asynchronously using promises
- Support for hooks (Scatter services), with sync/async execution


## Getting started

Initialize the Scatter container and define your roots:

`/app.js`
```javascript
var scatter = new Scatter();
scatter.addRoots([
  __dirname + '/plugins/*',
  __dirname + '/core'
]);

//Load a module
scatter.load('hello').then(function(mod) {
    mod.sayHello();
});

```

(The code above is just for demonstration, usually you will never need to manually `load` a module, modules are normally wired using [dependency injection](#dependency-injection) )

Define the module:

`/core/hello.js`
```javascript
module.exports = {
    sayHello: function() {
        console.log("Hello scattered world!");
    }
}
```

In Scatter, each root represents the starting point for the module namespace.
In the example above, the module resolver will look for a module named `hello` in this order:

1. `<path to project>/plugins/*/hello.js`
2. `<path to project>/core/hello.js`

With this simple logic, you can **scatter** your source code across separate folders, splitting your project as you like, based on functionalities, aspects, concepts, and with that automatically provide a way to modularly extend your project.


## Dependency Injection

Dependency injection is achieved by defining a `__scatter` descriptor in your module. With it you can control how the module is instantiated, but more importantly, how it's wired with other modules.

The most intuitive (but less powerful) type of dependency injection in Scatter is achieved using **factories**.


```javascript

module.exports = function(person) {
    return {
        sayHello: function() {
            console.log("Hello " + person.name + "!");
        }
    };
};
module.exports.__scatter = {
    args: ['models/person']
};
```

You can also use a **constructor**:

```javascript
function Hello(person) {
    this.person = person;
};
Hello.prototype = {};
Hello.prototype.sayHello: function() {
    console.log("Hello " + person.name + "!");
}

module.exports = Hello;
module.exports.__scatter = {
    args: ['models/person']
};

```

You can even inject **properties** directly into the module instance, with modules defined as object literals, factories or constructors (the example below uses an object literal): 

```javascript
var self = module.exports = {
    sayHello: function() {
        console.log("Hello " + self.person.name + "!");
    }
};
module.exports.__scatter = {
    properties: {
        person: 'models/person'
    } 
};
```


## Services

One of the most powerful features of Scatter is the services framework. You can use it to implement extension points, hooks or emit events.

To define a service, create a function in your module then declare it in your `__scatter` descriptor, using the `provides` property. 

To use a service inject a dependency in the format `svc!<namespace>/<service name>`, then invoke the service using a specific mode:  `sequence()`, `any()`, `pipeline()`.

Here is an example of how you can use it to register some routes in an `express` application.

`/components/home/routes/home.js`:
```javascript
var self = module.exports = {
    home: function(req, res) {
        ...
    },
    register: function(express) {
        express.get('/', self.home);
    }
};
self.__scatter = {
    provides: 'register'
}
```

`/components/aPlugin/routes/person.js`:
```javascript

var self = module.exports = {
    view: function(req, res) {
        ...
    },
    register: function(express) {
        express.get('/person', self.view);
    }
};
self.__scatter = {
    provides: 'register'
}
```

Now somewhere else in your project you can register all your routes at once using the `register` service:

`/core/expressApp.js`:
```javascript
...
var express = require('express');

module.exports = function(registerRoutes) {
    var self = {
        initializeApp: function() {
            ...

            return registerRoutes.sequence(self.express);
        }
    }
    return self;
};
module.exports.__scatter = {
    args: ['svc!routes/register'],
    provides: ['initializeApp']
}
```
Then the app entry point:

`/app.js`:
```javascript
var scatter = new Scatter();
scatter.addRoots([
  __dirname + '/components/*',
  __dirname + '/core'
]);

scatter.load('svc!initializeApp').sequence().then(function() {
    console.log('App initialized');
});
```

Notice how you can require a service exactly in the same way you require a module! **The service becomes a dependency**!

Another cool thing, is that the three modules do not know of the existence of each other, they are totally **decoupled**.

If you need a particular order of execution between your services, you can easily define it by specifying it in the `__scatter` descriptor, for example:

`/components/aPlugin/routes/person.js`:
```javascript
...
module.exports.__scatter = {
    ...
    provides: {
        register: {
            after: "routes/home"
        }
    }
}
```


# API

1. [Scatter](#scatter-1)
    * [constructor](#scatter-constructor)
    * [scatter.addRoots](#scatter-addroots)
    * [scatter.discoverRoots](#scatter-discoverroots)
    * [scatter.setNodeModulesDir](#scatter-setnodemodulesdir)
    * [scatter.load](#scatterload)
    * [scatter.registerModule](#scatterregistermodule)
    * [scatter.registerModuleInstance](#scatteregistermoduleinstance)
2. [__scatter descriptor](#__scatter-descriptor)
    * [args](#args)
    * [properties](#properties)
    * [provides](#provides)
    * [initialize](#initialize)
    * [type](#type)
3. [Dependency types](#injected-dependencies)
    * [Modules](#modules)
    * [Services](#services)
    * [Scatter container](#scatter-container)
    * [Npm modules](#npm-modules)
4. [package.json extensions](#packagejson-extensions)


## Scatter

The `Scatter` object is the entry point to create a brand new DI container for an application.

<a name="scatter-constructor" />
### new Scatter(options)

Create a new Scatter DI container.

__Arguments__

* `options` - An object containing a set of config options
    * `log` - A function in the format `function(level, message)` that will be used by Scatter to log messages. `level` is one of the npm log levels (e.g. silly, debug, verbose,warn, error).
    * `startProfiling` - A function in the format `function([sessionName, logLevel])` and returns that an object used for profiling some of the Scatter internals. This object should contai 3 methods:
        * `start()`
        * `pause()`
        * `end()`
    * `instantiateTimeout` - The number of milliseconds to wait for a module to be instantiated. Defaults to 700ms.
    * `initializeTimeout` - The number of milliseconds to wait for a module to be initialized. Defaults to 700ms.

__Example__

```javascript
var scatter = new Scatter({
   log: function(level, message) {
       console.log(level + ": " + message);
   }
});
```

<a name="scatter-addroots" />
### scatter.addRoots(roots)

Add one or more roots to the Scatter object, so they will be used to search for modules by the DI container. Roots added with this method don't need to contain a `package.json`, they are assumed to be Scatter module directories.

__Arguments__
* `roots` - A String (or Array of Strings) representing the root(s) to add. Supports glob syntax.

__Example__

```javascript
var scatter = new Scatter();
scatter.addRoots([__dirname + '/components/*', __dirname + '/core']);
```

<a name="scatter-discoverroots" />
### scatter.discoverRoots(basePath)

Walk recursively a directory to search for `package.json` describing Scatter roots. The `package.json` files must contain a `scatter` property:
* If empty - the directory containing the `package.json` file will be added as module root.
* if contains a `roots` property - the roots specified in the Array will be added as module roots.

__Arguments__

* `basePath` - String or Array of Strings, containing paths to use as starting point to discover module roots. Supports glob syntax.

__Example__

```sh
components
├── module1
│   ├── lib
│   └── package.json
└── module2
    └── src
```

```javascript
var scatter = new Scatter();
scatter.discoverRoots(__dirname + '/components');
```

`/components/module1/package.json`:
```javascript
{
    "scatter": {}
}
```

`components/module1` will be added as root, `components/module2` will NOT be added as it does not define a `package.json` with a `scatter` property.



