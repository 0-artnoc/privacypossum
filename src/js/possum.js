"use strict";

[(function(exports) {

const constants = require('./constants'),
  {Tabs} = require('./tabs'),
  {DomainStore} = require('./store'),
  {onMessage, onBeforeRequest, onBeforeSendHeaders, onRemoved} = require('./shim'),
  {MessageDispatcher} = require('./messages'),
  {WebRequest} = require('./webrequest'),
  PopupServer = require('./popup').Server;

class Possum {
  constructor(store) {
    if (typeof store === 'undefined') {
      store = new DomainStore(constants.DISK_NAME);
    }
    this.store = store;

    this.tabs = new Tabs();
    this.tabs.startListeners(onRemoved);

    this.webRequest = new WebRequest(this.tabs, this.store);
    this.webRequest.start(onBeforeRequest, onBeforeSendHeaders);

    this.messageListener = new MessageDispatcher(this.tabs, this.store),
    this.messageListener.start(onMessage);

    this.popup = new PopupServer(this.tabs);
    this.popup.start();
  }

  static async load(disk) {
    return new Possum(await DomainStore.load(constants.DISK_NAME, disk));
  }
}

Object.assign(exports, {Possum});

})].map(func => typeof exports == 'undefined' ? require.scopes.possum = func : func(exports));
