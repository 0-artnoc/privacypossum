"use strict";

(function(exports) {

class DiskMap {
  constructor(name, disk) {
    this.disk = disk;
    this.name = name;
    this.keys_key = 'keys_for_' + name;
    this.keys = new Set();
  }

  static async load(name, disk) {
    let out = new DiskMap(name, disk);
    await out.loadKeys();
    return out;
  }

  async loadKeys() {
    this.keys = await this.getKeys();

  }

  async getKeys() {
    return new Promise(resolve => {
      this.disk.get(this.keys_key, keys => {
        resolve(keys ? new Set(keys) : new Set([]));
      });
    });
  }

  maybeAddKey(key) {
    return new Promise(resolve => {
      if (this.keys.has(key)) {
        return resolve();
      }
      this.keys.add(key);
      return this.disk.set(this.keys_key, this.keys, resolve);
    });
  }

  async toMap() {
    let out = new Map();
    for (let key of this.keys) {
      out.set(key, await this.get(key));
    }
    return out;
  }

  async set(key, value) {
    await this.maybeAddKey(key);
    return new Promise(resolve => {
      this.disk.set((this.name + key), [key, value], resolve);
    });
  }

  get(key) {
    return new Promise(resolve => {
      this.disk.get((this.name + key), keyValue => resolve(keyValue[1]));
    });
  }
}

Object.assign(exports, {DiskMap});

})(typeof exports == 'undefined' ? require.scopes.disk_map = {} : exports);
