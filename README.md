[![NPM](https://nodei.co/npm/scatter.png)](https://nodei.co/npm/scatter/)

[![Build Status](https://travis-ci.org/mariocasciaro/scatter.png)](https://travis-ci.org/mariocasciaro/scatter)

# Scatter

Scatter allows you to split your projects in components located in **separated root directories**, and then uses **Dependency Injection** to make your code whole again.

**WARNING**: In this phase, Scatter API are subject to change frequently. Please submit your feedback and help stabilize its interface.

## Get started

Install:

```shell
npm install scatter
```

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

Ok, now it comes the cool part. Let's say that we now realize that we are using a too "cold" name for our planet and we want to give her a more poetic "Blue Planet". **There is no need to change the core code of our project!** Just create a new module in the `components` directory:


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

## More to come...



## License
MIT