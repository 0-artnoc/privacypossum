"use strict";

(function(exports) {

const {FakeDisk, FakeMessages} = require('./utils');

let url_;
try {
  url_ = URL;
} catch (e) {
  url_ = require('url').URL;
}

let disk_;
try {
  disk_ = chrome.storage.sync;
  disk_.newDisk = () => disk_;
} catch (e) {
  disk_ = FakeDisk;
  disk_.newDisk = () => new FakeDisk();
}

let onMessage_, sendMessage_;
try {
  onMessage_ = chrome.runtime.onMessage;
  sendMessage_ = chrome.runtime.sendMessage;
} catch (e) {
  let fm = new FakeMessages();
  onMessage_ = fm;
  sendMessage_ = fm.sendMessage.bind(fm);
}

let onBeforeRequest;
try {
  onBeforeRequest = chrome.webRequest.onBeforeRequest;
} catch (e) {
  onBeforeRequest = new FakeMessages();
}

Object.assign(exports, {
  URL: url_,
  Disk: disk_,
  onMessage: onMessage_,
  sendMessage: sendMessage_,
  onBeforeRequest,
});

})(typeof exports == 'undefined' ? require.scopes.shim = {} : exports);
