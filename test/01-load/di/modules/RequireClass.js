"use strict";

class clazz {
  constructor(depFactory) {
    this.prop = "requireClass";
    this.dep = depFactory;
  }
}

module.exports = clazz;

module.exports.__module = {
  type: 'constructor',
  args: ['DepFactory']
};
