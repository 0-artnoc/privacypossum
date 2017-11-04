"use strict";

(function(exports) {

const {DiskMap} = require('./disk_map'),
  {Tree, splitter} = require('./suffixtree'),
  {URL, Disk} = require('./shim');

class DomainTree {
  constructor(name, disk, splitter_) {
    if (typeof disk === 'undefined') {
      disk = Disk.newDisk();
    }

    if (typeof splitter_ === 'undefined') {
      splitter_ = splitter;
    }
    this.init(name, disk, splitter_);
  }

  init(name, disk, splitter) {
    this.tree = new Tree(splitter);
    this.diskMap = new DiskMap(name, disk);
    this.attachMethods();
  }

  static async load(name, disk) {
    let out = new DomainTree(name, disk);
    await out.diskMap.loadKeys();
    for (let key of out.keys) {
      out.set(key, await out.diskMap.get(key));
    }
    return out;
  }

  get keys() {
    return this.diskMap.keys;
  }

  attachMethods() {
    this.get = this.tree.get.bind(this.tree);
    this.getBranchData = this.tree.getBranchData.bind(this.tree);
  }

  has(key) {
    return this.keys.has(key);
  }

  async set(key, value) {
    this.tree.set(key, value);
    await this.diskMap.set(key, value);
  }

  async update(key, obj) {
    let value = this.get(key) || {};
    Object.assign(value, obj);
    await this.set(key, value);
  }

  /* URL specific stuff */
  getUrl(url) {
    url = new URL(url);
    return this.get(url.hostname);
  }

  async setUrl(url, value) {
    url = new URL(url);
    await this.set(url.hostname, value);
  }

  async updateUrl(url, callback) {
    await this.setUrl(url, callback(this.getUrl(url)));
  }
}

Object.assign(exports, {DomainTree});

})(typeof exports == 'undefined' ? require.scopes.store = {} : exports);
