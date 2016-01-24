"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = function(depObj) {
  return {
    prop: "requireFactory",
    dep: depObj
  };
};

exports["__module"] = {
  bootstrapMode: 'factory',
  args: ['anamespace/DepObjES6']
};


