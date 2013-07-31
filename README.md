[![NPM](https://nodei.co/npm/scatter.png)](https://nodei.co/npm/scatter/)

[![Build Status](https://travis-ci.org/mariocasciaro/scatter.png)](https://travis-ci.org/mariocasciaro/scatter)

# Scatter

Scatter allows you to split your projects in components located in **separated root directories**, and then uses **Dependency Injection** to make your code whole again.

**WARNING**: In this phase, Scatter API are subject to change frequently. Please submit your feedback and help stabilize its interface.

## Features

- Support for different project roots (e.g. core + plugins)
- Support for namespaces (follows the directory structure)
- Automatic discovery and registration of modules
- Module instantiation through factories, constructors or plain obejcts
- Instantiate and initialize modules asynchronously using promises
- Support for hooks (Scatter services), with sync/async execution

## Getting started

Intitialize the Scatter container and define your roots:
```javascript
// file: /app.js

var scatter = new Scatter({
    roots: [
        __dirname + '/components/*',
        __dirname + '/core'
    ]
});
```

Define your first simple module:
```javascript
// file: /core/hello.js

module.exports = {
    sayHello: function() {
        console.log("Hello scattered world!");
    }
}
```

Then load it:
```javascript
// file: /app.js

...

//Scatter uses promises at it's core
scatter.load('hello').then(function(mod) {
    mod.sayHello();
});
```

## Dependency Injection

Using the `__scattered` descriptor it's possible to control how the module is instantiated, but more importantly, how it's wired with other modules.

The most intuitive (but less powerful) type of dependency injection in Scatter is achieved using factories.

Let's refactor our  `hello.js` file above to load other modules:

```javascript
// file: /core/hello.js

module.exports = function(earth) {
    return {
        sayHello: function() {
            console.log("Hello " + earth.name + "!");
        }
    };
};
module.exports.__scattered = {
    args: ['planets/earth']
};
```

```javascript
// file: /core/planets/earth.js

module.exports = {
    name: 'Earth'
};
```

After the changes above, as expected, our `app.js` will now print `Hello Earth!`.

Ok, now it comes the cool part. Let's say we now realize that we are using a too "cold" name for our planet and we want to give it a more poetic "Blue Planet". **There is no need to change the core code of our project!** Just create a new module in the `components` directory:


```javascript
// file: /components/poetic/planets/earth.js

module.exports = {
    name: 'Blue Planet'
};
```

Now our `app.js` will magically print  `Hello Blue Planet!`. This is possible because, when creating our `scatter` container, we specified that the `components/*` directories has higher priority than the `core` root. Remember?
```javascript
// file: /app.js

var scatter = new Scatter({
    roots: [
        __dirname + '/components/*',
        __dirname + '/core'
    ]
});
```

## Scatter services

One of the most powerful features of Scatter is the services framework. You can use it to implement extension points, hooks or emit events.

To define a service, create a function in your module then declare it in your `__scattered` descriptor. Here is an example of how you can use it to register some routes in an `express` application.

```javascript
// file: /components/routes/home.js

var self = module.exports = {
    home: function(req, res) {
        ...
    },
    register: function(express) {
        express.get('/', self.home);
    }
};
self.__scattered = {
    provides: 'register'
}
```

```javascript
// file: /components/routes/person.js

var self = module.exports = {
    view: function(req, res) {
        ...
    },
    register: function(express) {
        express.get('/person', self.view);
    }
};
self.__scattered = {
    provides: 'register'
}
```

Now somewhere else in your project you can register all your routes:

```javascript
// file: /core/expressApp.js
...
module.exports = function(express, registerRoutes) {
    var self = {
        express: express(),
        initialize: function() {
            ...

            return registerRoutes(self.express);
        }
    }
    return self;
};
module.exports.__scattered = {
    args: ['npm!express', 'svc!routes/register']
}
```



## More to come...



## License
MIT