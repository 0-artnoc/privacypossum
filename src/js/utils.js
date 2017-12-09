"use strict";

[(function(exports) {

const {activeIcons, inactiveIcons} = require('./constants'),
    {setIcon} = require('./shim');

class BrowserDisk {
  constructor(disk) {
    this.disk = disk;
  }

  get(key, cb) {
    this.disk.get(key, (res) => {
      return (res.hasOwnProperty(key)) ? cb(res[key]) : cb();
    });
  }

  set(key, value, cb) {
    return this.disk.set({[key]: value}, cb);
  }
}

// move to shim
function makeTrap() {
  let target = () => {};
  let lol = () => {
    return new Proxy(target, descriptor);
  };
  let descriptor = {
    apply: lol,
    get: lol,
  };
  return lol();
}

/*
 * Make a class have an eventListener interface. The base class needs to
 * implement a `getData` function and call the `onChange` function when
 * appropriate.
 */
let listenerMixin = (Base) => class extends Base {
  constructor() {
    super();
    this.funcs = new Set();
    this.onChange = this.onEvent;
  }

  addListener(func) {
    this.funcs.add(func)
  }

  removeListener(func) {
    this.funcs.delete(func);
  }

  onEvent() {
    this.funcs.forEach(func => func(this.getData()));
  }

  getData() {
  }
}

// todo after setIcon return's a promise, make this return a promise
function setTabIconActive(tabId, active) {
  let icons = active ? activeIcons : inactiveIcons;
  setIcon({tabId: tabId, pah: icons});
}

class Listener extends listenerMixin(Object) {}

Object.assign(exports, {
  BrowserDisk,
  makeTrap,
  listenerMixin,
  Listener,
  setTabIconActive,
});

})].map(func => typeof exports == 'undefined' ? require.scopes.utils = func : func(exports));
