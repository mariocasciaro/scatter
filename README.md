[![NPM](https://nodei.co/npm/scatter.png)](https://nodei.co/npm/scatter/)

[![Build Status](https://travis-ci.org/mariocasciaro/scatter.png)](https://travis-ci.org/mariocasciaro/scatter)

# Scatter

Scatter allows you to split your project in components located in **separated root directories**, and then uses **Dependency Injection** to make your code whole again.

Every module created for Scatter can be used even without the Scatter DI container, they are usually javascript objects, factories and constructors that accept their dependencies as input. The only difference from a *plain* module is that Scatter reads a property named `__scatter` to extract the information needed to initialize the module and inject dependencies.


1. [Features](#features)
2. [Getting Started](#getting-started)
3. [Module resolver](#module-resolver)
3. [Dependency Injection](#dependency-injection)
4. [Module lifecycle](#module-lifecycle)
5. [Services](#services)
6. [API Docs](#api)


## Features

- Scatter your project across different directories (e.g. core + plugins)
- Support for namespaces (by default it follows the directory structure, like Java packages)
- Automatic discovery and registration of modules
- Module instantiation through factories, constructors or plain objects
- Instantiate and initialize modules asynchronously using promises
- Support for hooks (Scatter services), with sync/async execution


## Getting started

Define the module:

`/core/hello.js`
```javascript
module.exports = {
    sayHello: function() {
        console.log("Hello scattered world!");
    }
}
```

Initialize the Scatter container and define its roots:

`/app.js`
```javascript
var scatter = new Scatter();
scatter.addRoots([
  __dirname + '/core'
]);

//Load a module
scatter.load('hello').then(function(mod) {
    mod.sayHello();
});

```

(The code above is just for demonstration, usually you will never need to manually `load` a module, modules are normally wired together using [dependency injection](#dependency-injection) )


## Module resolver

In Scatter, **you don't need to manually register each module** with the DI container (although you can), modules are automatically resolved from the root directories specified during the container creation.

__Module Naming__

Each module is named after it's relative path from the root directory + the name of the file (without the `.js` extension. For example if we add a root:

`/project/lib/`

and then define a module:

`/project/lib/foo/bar.js`

The module will be available in the DI container with the name:

`foo/bar`

__Loading Priority__

The order you use to add new roots to Scatter is important, as it will affect the priority of the module loading. **Modules in roots defined first will override modules with the same name in roots defined for last**. 

Suppose you define 2 roots, in this order:

1. `/project/plugins/pluginA`
1. `/project/core`

Now suppose you define 2 modules:

* `/project/plugins/pluginA/foo.js`
* `/project/core/foo.js`

Now, since you defined the root `/project/plugins/pluginA` first, then loading the dependency `foo` will load the module `/project/plugins/pluginA/foo.js`.

__Delegate roots definition to components__

Sometimes to simplify the creation and distribution of third party components, it is useful to have the possibility to bundle multiple roots into the same component. This is particularly useful if you want to distribute a Scatter component as npm module.

To delegate the definition of the roots to the components, Scatter supports an **autodiscovery** mode.

```javascript
scatter.discoverRoots(basePaths);
```

By invoking the function above, Scatter will search recursively the specified directories for a `package.json` file. If such a file is found and it contains a property named `scatter`, the parent directory of the file will be added as root. Alternatively to specify a different root, you can define a `scatter.roots` property in the `package.json` specifying explicitly the roots to add.

More info on that on the API docs [scatter.discoverRoots](#scatter-discoverroots)

For the specific case were you want to let Scatter discover roots in a list of npm modules, use the method [scatter.setNodeModulesDir](#scatter-setnodemodulesdir). This will also allow you to require standard npm modules from the DI container with the syntax `npm!<module name>`


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

## Module lifecycle

A module in Scatter has 3 states:

1. *Resolved* - The module is known to Scatter, it's kept in its internal data structures, but it's not ready yet to use.
2. *Instantiated* - The module is instantiated (e.g. the factory or constructor is invoked). At this point the module instance exists but it's not fully usable yet, its dependencies are injected but they might not yet be initialized.
3. *Initialized* - The module is initialized, the `initialize` method was already invoked and all the dependencies are initialized as well.

To consistently manage **loops** and **deadlocks** between module dependencies it is important to note that: 

* During the *instantiation* phase (factory or constructor) and the injection of dependencies as `properties`, all the dependencies injected are in the state *instantiated*, so NOT yet ready to be used (but ready to be assgned, for example).
* During the invocation of the `initialize` function, the invocation of services, and the `load` methods, all the dependencies injected are guaranteed to be in state *initialized*.


__Example__

```javascript
module.exports = function(foo) {
    //foo here is instantiated but NOT initialized
}
module.exports.__scatter = {
    args: ['foo'],
    initialize: [['bar'], function(bar) {
        //bar is guaranteed to be initialized
    }]
}
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
    * [scatter.load](#scatter-load)
    * [scatter.registerModule](#scatter-registermodule)
    * [scatter.registerModuleInstance](#scatter-registermoduleinstance)
2. [__scatter descriptor](#scatter-descriptor)
    * [args](#desc-args)
    * [properties](#desc-properties)
    * [provides](#desc-provides)
    * [initialize](#desc-initialize)
    * [type](#desc-type)
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

Add one or more roots to the Scatter object, so they will be used to search for modules by the DI container.

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

<a name="scatter-setnodemodulesdir" />
### scatter.setNodeModulesDir(nodeModulesDir[, disableAutodiscover])

Tells Scatter where to fin the `node_modules` directory. This enabled the use of `npm!` dependencies, with with you can require normal npm modules from the DI container. Also it autodiscover Scatter roots inside the npm modules.

__Arguments__

* `nodeModulesDir` - Path to the `node_modules` directory of the project
* `disableAutodiscover` - If true Scatter will not autodiscover eventual components roots defined into the npm modules

<a name="scatter-load" />
### scatter.load(name)

Manually load a dependency from the DI container.

__Arguments__

* `name` - The dependency name

__Returns__

A promise for the loaded module.

__Example__

```javascript
scatter.load('foo/bar').then(function(mod) {
    // do something amazing with mod
}
```

<a name="scatter-registermodule" />
### scatter.registerModule(name, rawModule [, descriptor])

Register a raw module that is not yet instantiated nor initialized. Scatter will take care to instantiate and initialize it when needed, usine the information in the `__scatter` descriptor.

__Arguments__

* `name` - Full name of the module (complete with namespace)
* `rawModule` - The raw module object
* `descriptor` - If provided it will be used in place of the `__scatter` property.

__Returns__

A newly created `Module` object.

__Example__

```javascript
var mod = function(foo) {
    return {
        hello: function() {
            console.log("Hello " + foo.name);
        }
    };
};
mod.__scatter = {
    args: ['foo']
}

scatter.registerModule('bar/mod', mod);
```


<a name="scatter-registermoduleinstance" />
### scatter.registerModuleInstance(name, instance[, descriptor])

Registers a module instance already initialized and wired outside the Scatter container.

__Arguments__

* `name` - The full name of the module
* `instance` - The module instance
* `descriptor` - The module descriptor, in place of the `__scatter` property that usually is part of the raw module, not the module instance. At this stage only the `provides` property of the descriptor is relevant.

__Returns__

A newly created `Module` object.

__Example__

```javascript

var instance = {
    hello: function() {
        console.log('hello everybody!');
    }
}

scatter.registerModuleInstance('bar/mod', instance, {});
```

<a name="scatter-descriptor" />
## The __scatter descriptor

<a name="desc-args" />
### args

<a name="desc-properties" />
### properties

<a name="desc-provides" />
### provides

<a name="desc-initialize" />
### initialize

<a name="desc-type" />
### type

