Synopsis
======

Scatter allows you to split your project in **particles** (components), and then uses **Dependency Injection** to make your code whole again.

Applications created with Scatter are **extensible out-of-the box**. Since every dependency is "virtual", you can override and extend every module. In addition by using Scatter [Services](#services) you can provide explicit extension points to your application.

Every module created for Scatter can be used even without the Scatter DI container, they are usually javascript objects, factories and constructors that accept their dependencies as input. The only difference from a *plain* module is that Scatter reads a property named `__module` to extract the information to initialize the module and inject dependencies.

[![NPM](https://nodei.co/npm/scatter.png?downloads=true)](https://nodei.co/npm/scatter/)

[![Build Status](https://travis-ci.org/mariocasciaro/scatter.png)](https://travis-ci.org/mariocasciaro/scatter) [![Dependency Status](https://david-dm.org/mariocasciaro/scatter.png)](https://david-dm.org/mariocasciaro/scatter) [![Coverage Status](https://coveralls.io/repos/mariocasciaro/scatter/badge.png)](https://coveralls.io/r/mariocasciaro/scatter)

## Stability

2 - Unstable

The API is in the process of settling, but has not yet had
sufficient real-world testing to be considered stable.


## TOC

* [Features](#features)
* [Guide](#guide)
    1. [Examples](#examples)
    1. [Getting Started](#getting-started)
    1. [Module resolver](#module-resolver)
    1. [Dependency Injection](#dependency-injection)
    1. [Module lifecycle](#module-lifecycle)
    1. [Services](#services)
    1. [Extend and Override Modules](#extend)
* [API Docs](#api)
* [Contributors](#contributors)


## Features

- Scatter your project across different directories (particles)
- Support for namespaces (by default, module name follow the directory structure, like Java packages)
- Automatic discovery and registration of modules
- Module instantiation through factories, constructors or plain objects
- Instantiate and initialize modules asynchronously using promises
- Support for hooks (Scatter services), with sync/async execution

# Guide

## Examples

If you prefer code to english text, then go straight to the [examples](https://github.com/mariocasciaro/scatter/tree/master/examples) directory.

## Getting started

Define a module:

`/core/hello.js`:
```javascript
module.exports = {
    sayHello: function() {
        console.log("Hello scattered world!");
    }
}
```

Add the particle descriptor:

`/core/particle.json`
```javascript
{
    "name": "helloComponent"
}
```


Initialize the Scatter container and register the new particle directory:

`/app.js`
```javascript
var scatter = new Scatter();
scatter.registerParticle([
  __dirname + '/core'
]);

//Load and use the module
scatter.load('hello').then(function(mod) {
    mod.sayHello();
});

```

(Usually you will never need to manually `load` a module, modules are normally wired together using [dependency injection](#dependency-injection) )


## Module resolver

In Scatter, **you don't need to manually register each module** with the DI container (although you can), modules are automatically resolved from the particle directories specified during the container creation.

__Module Naming__

Each module is named after it's relative path from its particle directory + the name of the file (without the `.js` extension). For example if we add a particle from the directory:

`/project/lib/`

and then define a module:

`/project/lib/foo/bar.js`

The module will be available in the DI container with the name:

`foo/bar`

__Particles and subparticles__

A **Particle** in Scatter is a container for a set of modules. To define a particle directory it is necessary to create a `particle.json` file in the particle directory itself. The json file must contain at least a `name` property, for example:

`myparticledir/particle.json`:
```javascript
{
    "name": "<particle name>"
}
```
If `particle.json` is not found, the directory will not be added as particle to the Scatter DI container.

A particle might define multiple subparticles by specifying the `subparticles` property (containing relative paths to subparticles directories), for example:

`myparticledir/particle.json`:
```javascript
{
    "name": "<particle name>",
    "subparticles": [
        "subDir1", "subDir2"
    ]
}
```

*Note*: Each Subparticle dir must define its own `particle.json` file. When specifying subparticles the "parent" particle directory is **not** registered in the DI container, only subparticles will be.

__Importing modules from the `node_modules` directory__

You can automatically register all the Scatter particles in the `node_modules` directory by using the method [scatter.setNodeModulesDir](#scatter-setnodemodulesdir). This will also allow you to require standard npm modules from the DI container with the syntax `npm!<module name>`


## Dependency Injection

Dependency injection is achieved by defining a `__module` descriptor in your module. With it you can control how the module is instantiated, but more importantly, how it's wired with other modules.

The most intuitive type of dependency injection in Scatter is achieved by  using **factories**.


```javascript
module.exports = function(person) {
    return {
        sayHello: function() {
            console.log("Hello " + person.name + "!");
        }
    };
};
module.exports.__module = {
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
module.exports.__module = {
    args: ['models/person']
};

```

You can even inject **properties** directly into the module instance (injected after the module is instantiated)

```javascript
var self = module.exports = {
    sayHello: function() {
        console.log("Hello " + self.person.name + "!");
    }
};
module.exports.__module = {
    properties: {
        person: 'models/person'
    }
};
```

## Module lifecycle

A module in Scatter has 3 states:

1. *Resolved* - The module is known to Scatter, it's kept in its internal data structures, but it's not ready yet to use.
2. *Instantiated* - The module is instantiated (e.g. the factory or constructor is invoked). At this point the module instance exists but it's not fully usable yet (the properties are not injected and `initialize` is not invoked).
3. *Initialized* - The module is initialized, the `initialize` method was already invoked and all the dependencies are injected and initialized as well.

All modules are **by default injected in an initialized state**. Sometimes though you might have **loops** between dependencies, in this case you should know how the module lifecycle works to find workarounds.

For example, you will have a **deadlock** if you have two modules which try to inject each other at instantiation time (using `args` with factory/constructor). To go around this, just inject one of the two modules with the `properties` command being sure you require an **instance only** of that module using the dependency `delayinit!<module name>`, otherwise you will have a deadlock at initialization time.

The same technique can be applied with deadlocks at initialization time (injected with `properties` or `initialize`).

PS: Don't worry, even with `delayinit!<module name>` the module will be fully initialized as soon as the main application cycle starts.


__Example__

`/core/foo.js`:
```javascript
module.exports = function(bar) {
    //bar is just the module instance, you can assign it,
    //but be careful when using it at this point

    var self = {
      doSomething: function() {
        console.log(bar.name);
      }
    };
    return self;
}
module.exports.__module = {
    args: ['delayinit!bar']
}
```

`/core/bar.js`:
```javascript
module.exports = function() {
    var self = {
      name: 'bar',
      useFoo: function() {
        self.foo.doSomething();
      }
    };
    return self;
}
module.exports.__module = {
    properties: {foo: 'foo'}
}
```


## Services

One of the most powerful features of Scatter is the services framework. You can use it to implement extension points, hooks or emit events.

To define a service, create a function in your module then declare it in your `__module` descriptor, using the `provides` property.

To use a service inject a dependency in the format `svc!<namespace>/<service name>`, then invoke the service using a specific mode:  `sequence()`, `any()`, `pipeline()`. Alternatively you can specify the mode directly into the dependency: `svc|sequence!<namespace>/<service name>`

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
self.__module = {
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
self.__module = {
    provides: 'register'
}
```

Now somewhere else in your project you can register all your routes at once using the `register` service:

`/components/core/expressApp.js`:
```javascript
...
var express = require('express');

module.exports = function(registerRoutes) {
    var self = {
        initializeApp: function() {
            ...

            return registerRoutes(self.express);
        }
    }
    return self;
};
module.exports.__module = {
    args: ['svc|sequence!routes/register'],
    provides: ['initializeApp']
}
```
Then the app entry point:

`/app.js`:
```javascript
var scatter = new Scatter();
scatter.registerParticle(__dirname + '/components/*');

scatter.load('svc|sequence!initializeApp').then(function(initializeApp) {
    return initializeApp();
}).then(function() {
    console.log('App initialized');
});
```

Notice how you can require a service exactly in the same way you require a module! **The service becomes a dependency**!

Another cool thing, is that the three modules do not know of the existence of each other, they are totally **decoupled**.

If you need a particular order of execution between your services, you can easily define it by specifying it in the `__module` descriptor, for example:

`/components/aPlugin/routes/person.js`:
```javascript
...
module.exports.__module = {
    ...
    provides: {
        register: {
            after: "routes/home"
        }
    }
}
```

<a name="extend" />
## Extend and Override Modules

The real power of Scatter resides in the fact that every module can be overridden or extended by another particle. This way it is possible to change the behaviour of any module in any particle!

To declare that a particle is going to override the modules of another one it is necessary to add the property `overrides` into the `particle.json` descriptor, for example:

`/components/EnhancedUser/particle.json`
```javascript
{
    "name": "EnhancedUser",
    "overrides": ["BasicUser"]
}
```

Now as example look how it's possible to extend an hypothetical `User` module with some extra features.

`/components/BasicUser/User.js`
```javascript
var self = module.exports = {
    username: "Mario",
    hello: function() {
        console.log("Hello " + self.username);
    }
}
```

`/components/EnhancedUser/User.js`
```javascript
module.exports = function(User) {
    User.username = "Luigi";
    return User;
}
module.exports.__module = {
    args: ['User']
}
```

With the module above with are modifying the module `User` by changing its username to `Luigi`. This is just a basic change but thanks to the power of javascript we can transform the parent module in many different ways!


Notice the dependency `User` that is injected into the factory, since we specified that the particle `EnhancedUser` overrides the particle `BasicUser`, Scatter knows how to resolve the `User` module from the dependency tree.

Now we can initialize Scatter and load the `User` module:

`/app.js`:
```javascript
var scatter = new Scatter();
scatter.registerParticle(__dirname + '/components/*');

scatter.load('User').then(function(user) {
    user.hello();
});
```

What the code above will print?


# API

1. [Scatter](#scatter-1)
    * [constructor](#scatter-constructor)
    * [scatter.registerParticles](#scatter-registerparticles)
    * [scatter.registerParticle](#scatter-registerparticle)
    * [scatter.setNodeModulesDir](#scatter-setnodemodulesdir)
    * [scatter.load](#scatter-load)
    * [scatter.registerModule](#scatter-registermodule)
    * [scatter.registerModuleInstance](#scatter-registermoduleinstance)
2. [__module descriptor](#module-descriptor)
    * [type](#desc-type)
    * [initialize](#desc-initialize)
    * [args](#desc-args)
    * [properties](#desc-properties)
    * [provides](#desc-provides)
    * [overrideProvides](#desc-overrideProvides)
3. [Dependency loaders](#dependency-loaders)
    * [Default](#loader-module)
    * [npm!](#loader-npm)
    * [svc!](#loader-svc)
    * [container!](#loader-container)
    * [delayInit!](#loader-delay)
4. [Particle descriptor(particle.json)](#particle-descriptor)


## Scatter

The `Scatter` object is the entry point to create a brand new DI container for an application.

<a name="scatter-constructor"></a>
### new Scatter(options)

Create a new Scatter DI container.

__Arguments__

* `options` - An object containing a set of config options
    * `log` - A function in the format `function(level, message)` that will be used by Scatter to log messages. `level` is one of the npm log levels (e.g. silly, debug, verbose,warn, error).
    * `startProfiling` - A function in the format `function([sessionName, logLevel])` and returns that an object used for profiling some of the Scatter internals. This object should contai 3 methods:
        * `start()`
        * `pause()`
        * `end()`
    * `instantiateTimeout` - The number of milliseconds to wait for a module to be instantiated. Defaults to 5000ms.
    * `initializeTimeout` - The number of milliseconds to wait for a module to be initialized. Defaults to 5000ms.

__Example__

```javascript
var scatter = new Scatter({
   log: function(level, message) {
       console.log(level + ": " + message);
   }
});
```

<a name="scatter-registerparticles"></a>
### scatter.registerParticles(particlesDirs)

Register one or more particles with the Scatter container.

__Arguments__

* `particlesDirs` - A String (or Array of Strings) representing the particle(s) directories to add. Supports glob syntax.

__Example__

```javascript
var scatter = new Scatter();
scatter.registerParticles([__dirname + '/components/*', __dirname + '/core']);
```

<a name="scatter-registerparticle"></a>
### scatter.registerParticle(particleDir)

Alias of [scatter.registerParticles](#scatter-registerparticles)

<a name="scatter-setnodemodulesdir"></a>
### scatter.setNodeModulesDir(nodeModulesDir)

Tells Scatter where to find the `node_modules` directory. This enable the use of `npm!` dependencies, to require normal npm modules from the DI container. Also it will register all the Scatter particles found inside the npm modules.

__Arguments__

* `nodeModulesDir` - Path to the `node_modules` directory of the project

<a name="scatter-load" />
### scatter.load(name)

Manually load a dependency (or set of dependencies) from the DI container.

__Arguments__

* `name` - [String] The dependency name, or [Array] of dependencies.

__Returns__

A promise for the loaded module or for an [Array] of the loaded modules.

__Example__

```javascript
scatter.load('foo/bar').then(function(mod) {
    // do something amazing with mod
}
```

<a name="scatter-registermodule"></a>
### scatter.registerModule(name, rawModule [, descriptor])

Register a raw module that is not yet instantiated nor initialized. Scatter will take care to instantiate and initialize it when needed, using the information in the `__module` descriptor.

__Arguments__

* `name` - Full name of the module (complete with namespace)
* `rawModule` - The raw module object
* `descriptor` - If provided it will be used in place of the `__module` property.

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
mod.__module = {
    args: ['foo']
}

scatter.registerModule('bar/mod', mod);
```


<a name="scatter-registermoduleinstance"></a>
### scatter.registerModuleInstance(name, instance[, descriptor])

Registers a module instance already initialized and wired outside the Scatter container.

__Arguments__

* `name` - The full name of the module
* `instance` - The module instance
* `descriptor` - The module descriptor, in place of the `__module` property that usually is part of the raw module, not the module instance. At this stage only the `provides` property of the descriptor is relevant.

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

<a name="module-descriptor"></a>
## The __module descriptor
The `__module` descriptor is a property of the raw module object used by Scatter to determine how to wire the module, how to instantiate it and what services provides.

__Examples__
Using an object literal:
```javascript
module.exports = {
    //... put your module content here
};
module.exports.__module = {
    //descriptor
}
```

Using a factory:
```javascript
module.exports = function() {
    return {
        //... put your module content here
    }
};
module.exports.__module = {
    //descriptor
}
```
<a name="desc-type"></a>
### __module.type
`String`. The `type` specifies how the module will be instantiated. There are 3 possible values:

* `factory`: The module will be instantiated by invoking the module object as a function. The return value of the invocation will become the module instance.
* `constructor`: The module will be instantiated by invoking `new` on the module object.
* `object`: The module will be taken as-is, no instantiation step will occur.

Scatter automatically determines the type of a module, so usually **there is no need to specify the type**, unless you don't want to force the autodetected value.
Scatter detects the type following those simple rules:

* If the module is a `Function` without a `prototype`, then `type='factory'`
* If the module is a `Function` with a non-empty `prototype` then `type='constructor'`
* All the rest defaults to `type: 'object'`

<a name="desc-initialize"></a>
### __module.initialize
`Array: [[String], String|Function]`. A function to be executed as the last step of the module instantiation/initialization. The function can receive as arguments a set of injected dependencies, using the format:
`[[<list of dependencies>], function(<injected dependencies>) {}]`

The function can also be a `String`, in which case `module_instance[<function name>]` will be invoked.

The `initialize` function is executed in the context of the module instance.

__Example__
```javascript
module.exports = {
    verb: "Hello",
    name: "World",
    punctuation: "!"
}
module.exports.__module = {
    initialize: [['utilities/joiner'], function(joiner) {
        this.phrase = joiner(this.verb, this.World, this.punctuation);
    }]
}
```

<a name="desc-args"></a>
### __module.args
`Array` of `Strings`. Lists the dependencies to be injected as arguments when invoking the module factory or the module constructor.

__Example__
```javascript
module.exports = function(fooBar) {
    //awesome stuff
};
module.exports.__module = {
    args: ['foo/bar']
}
```

<a name="desc-properties"></a>
### __module.properties
`Object`. Inject dependencies as module instance properties. The `properties` object, is a map where the keys are the names of the properties and the values are the dependencies to inject.

The properties will be injected into the module instance in case a module is instantiated with a factory or a constructor.

__Example__
```javascript
module.exports = function() {
    var self = {
        doSomething: function() {
            return self.injectedProperty;
        }
    };
    return self
};
module.exports.__module = {
    properties: {
        injectedProperty: 'foo/bar'
    }
}
```

<a name="desc-provides"></a>
### __module.provides
`Object`. Specifies the [Services](#services) exposed by the module. Each service name specified will map directly to a method with the same name exposed by the module instance.

In the `provides` descriptor it is also possible to force the order of execution of the service, specifying if it should execute after or before the same service is invoked on the list of modules specified respectively in the `after` and `before` parameters. Globs are allowed when specifying modules in `after` and `before`.

__Formats__

* Long format:
```javascript
    provides: {
        <service_name>: {
            after: [<list of modules>] OR '<single module>'
            before: [<list of modules>] OR '<single module>'
        }
    }
```

* Short format (if only `after` need to be specified):
```javascript
    provides: {
        <service_name>: [<list of modules>] OR '<single module>'
    }
```

* Very short format (if no `before`/`after` need to be specified):
```javascript
provides: [<list of service names>]
```

* Lonely format (if only one service need to be specified):
```javascript
provides: '<service name>'
```

__Examples__
```javascript
module.exports = {
    helloService: function() {
        //baboooom
    }
};
module.exports.__module = {
    provides: {
        helloService: {
            after: ['namespace/to/module/*'],
            before: ['foo/bar/AModule']
        }
    }
}
```

<a name="desc-overrideprovides"></a>
### __module.overrideProvides
`Boolean`, default: `false`. If the module is extending/overriding another module, this flag tells Scatter if the parent `provides` descriptor has to be overridden (`true`) or merged (`false`)


<a name="dependency-loaders"></a>
## Dependency loaders

Scatter comes with a versatile and extensible **dependency loader**. With this feature, the DI container can inject not only modules but any sort of objects.

It is possible to invoke a specific loader with the syntax:
`<loader name>|<loader params>!<dependency name>`

Now follows a list of loaders shipped with Scatter.

<a name="loader-module"></a>
### Default Loader

By default, if no loader is specified in the dependency, a module will be loaded.

__Example__
```javascript
module.exports = function(moduleDependency) {
    [...]
}
module.exports.__module = {
    args: ['a/module/dependency']
}
```

<a name="loader-svc"></a>
### svc!

The `svc!` loader allows to load [Services](#services). It will load a function representin the Service that when invoked will return a promise for the service executution.

__Syntax__

`svc|[<mode>]!<service name>`

Where:

* `<mode>`: Optional, if not specified a Service object will be returned with methods named after each `mode` available (and described below). Modes can be:
    * `sequence`: the methods in the service will be invoked sequencially
    * `pipeline`: the methods in the service will be invoked in pipeline where the return value of a method will be given as input to the next one.
    * `any`: the Service invocation will return immediately as soon as the first method invocation in the chain will return a non undefined value.
    * `invoke`: Alias of `sequence`, to be used when the executin mode is not relevant.
* `<service name>` is the name of the service in the form `<namespace>/<service name>`. The Service will invoke `<service name>` over all the modules providing `<service name>` under the namespace `<namespace>` recursively.

__Example__
```javascript
module.exports = function(service) {
    return {
        hello: function() {
            service("hello").then(function() {
                //done
            });
        }
    }
}
module.exports.__module = {
    args: ['svc|any!foo/bar/helloService']
}
```


<a name="loader-npm"></a>
### npm!

The `npm!` loader allows to inject an npm module from the `node_modules` directory specified in the Scatter object (see [setNodeModulesDir](#scatter-setnodemodulesdir)).

This is different from invoking `require('module')`, since the module will not be resolved using the default Node.js convensions (e.g. no relative dirs allowed, does not load the module from the module's local `node_modules` dir). Instead, the npm module will always be resolved from the `node_modules` directory configured when the Scatter container is initialized.

The advantage of this, is that different Scatter modules will always access the same version (and same instance!) of the npm module they require with `npm!`. Although this is not always desirable, sometimes can be very useful when your modules need to share an npm module across all the application they are injected to.

__Syntax__

`npm!<npm module name>`

__Example__

```javascript
module.exports = function(express) {
    [...]
}
module.exports.__modules = {
    args = ['npm!express']
}
```

<a name="loader-container"></a>
### container!

Will load a private version of the Scatter container for the module requiring it. The loaded container will only have the `load` method.

__Example__
```javascript
module.exports = function(container) {
    [...]
}
module.exports.__modules = {
    args = ['container!']
}
```

<a name="loader-delay"></a>
### delayInit!

This loader will cause the DI container to load a **not initialized** module (only instantiated). This might be useful in case there are loops into module dependencies and delaying the initialization of the module can solve the loop. Please look at [module lifecycle](#module-lifecycle) for some use cases.

<a name="particle-descriptor"></a>
## particle.json

The `particle.json` file describes and configures a Scatter component.

* `name`: The name of the particle.  Optional if subparticles defined.
* `subparticles`: `Array`, Optional. A list of relative paths pointing to other directories containing a particle (and therefore a `particle.json` file).
* `overrides`: `Array`, Optional. A list of components (particle names) that this particle  is overriding/extending.
* `exclude`: `Array`, Optional. An list of files to exclude from being considered for DI (e.g. client side js). Uses Globs.


# Contributors

* [Mario Casciaro](https://github.com/mariocasciaro) [@mariocasciaro](https://twitter.com/mariocasciaro)
* [Your name here]


[![Bitdeli Badge](https://d2weczhvl823v0.cloudfront.net/mariocasciaro/scatter/trend.png)](https://bitdeli.com/free "Bitdeli Badge")