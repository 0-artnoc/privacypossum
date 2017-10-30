"use strict";

(function(exports) {

const SENTINEL = '.',
  LABEL = 'label',
  root_label = 'root';

class Node extends Map {
  constructor(label) {
    super();
    this[LABEL] = label;
  }

  setLabelData(data) {
    this[SENTINEL] = data;
  }

  getLabelData() {
    return this[SENTINEL];
  }

  hasLabelData() {
    return this.hasOwnProperty(SENTINEL);
  }
}

function setAgg(node, part) {
  if (!node.has(part)) {
    node.set(part, new Node(part));
  }
  return node.get(part);
}

function getAgg(node, part) {
  return node.get(part);
}

function branchAgg(node, part, agg) {
  node = node.get(part);
  if (typeof node !== 'undefined' && node.hasLabelData()) {
    agg.set(part, node.getLabelData());
  }
  return node;
};

class Tree {
  constructor(splitter) {
    this.splitter = splitter;
    this._root = new Node(root_label);
  }

  aggregate(key, aggFunc, aggregator) {
    let parts = this.splitter(key),
      len = parts.length,
      node = this._root;

    for (let i = 0; i < len; i++) {
      let part = parts[i];
      node = aggFunc(node, part, aggregator);
      if (typeof node === 'undefined') {
        return undefined;
      }
    }
    return node
  }

  setItem(key, val) {
    let node = this.aggregate(key, setAgg);
    node.setLabelData(val);
  }

  getItem(key) {
    let node = this.aggregate(key, getAgg);
    return (typeof node === 'undefined') ? undefined : node.getLabelData();
  }

  getBranchData(key) {
    let aggregator = new Map();
    let node = this.aggregate(key, branchAgg, aggregator)
    return (typeof node == 'undefined') ? undefined : aggregator;
  }
};

function splitter(splitme) {
  return splitme.split('.').reverse();
}

Object.assign(exports, {Tree, splitter});

})(typeof exports == 'undefined' ? require.scopes.suffixtree = {} : exports);
