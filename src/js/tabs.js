/**
 * Provides a synchronous record of tabs and their frames. Data is recorded from the
 * webrequest api.
 */
"use strict";

[(function(exports) {

const {URL, setBadgeText} = require('./shim'),
  constants = require('./constants'),
  {listenerMixin, setTabIconActive, isBaseOfHostname} = require('./utils'),
  {isThirdParty} = require('./parties'),
  {getBaseDomain} = require('./basedomain/basedomain');

class Resource {
  constructor({url, method, type}) {
    this.url = url;
    this.method = method;
    this.type = type;
  }
}

class Frame {
  constructor({frameId, url, tabId, parentFrameId, requestId, type, urlObj}) {
    this.id = frameId;
    this.tabId = tabId;
    this.parentId = parentFrameId;
    this.requestId = requestId;
    this.resources = new Map();
    this.children = new Map();

    // Sometimes we get resources, but don't have their frames, so we don't
    // always have the frame url and stuff
    if (type && type.endsWith('_frame')) {
      this.url = url;
      this.type = type;
      if (!(urlObj instanceof URL)) {
        urlObj = new URL(url);
      }
      this.urlObj = urlObj;
    }
  }

  hasUrl(details) {
    return this.resources.has(details.url);
  }

  hasResource(details) {
    return this.resources.get(details.url).type === details.type;
  }

  recordResource(details) {
    if (!this.hasUrl(details)) {
      this.resources.set(details.url, new Resource(details));
    }
  }
}

class Tab extends listenerMixin(Map) {
  constructor(id) {
    super();
    this.active = true;
    this.id = id;
    this.blocked = new Set();

    this.onChange = this.onEvent;
    this.setBadgeText(''); // clear badge
  }

  getData() {
    return Array.from(this.blocked);
  }

  setBadgeText(text) {
    setBadgeText({text, tabId: this.id});
  }

  setActiveState(active) {
    if (active === this.active) {
      return;
    }
    this.toggleActiveState();
  }

  toggleActiveState() {
    this.active = !this.active;
    if (!this.active) {
      this.setBadgeText('');
    }
    setTabIconActive(this.id, this.active);
  }

  markResponse(response, url) {
    if (response === constants.NO_ACTION || !this.active) {
      return;
    }

    if (!this.blocked.has(url)) {
      this.blocked.add(url);
      this.onChange();
    }

    if (this.blocked.size > 0) {
      this.setBadgeText('' + this.blocked.size);
    }
  }
}

class Tabs {
  constructor() {
    this._data = new Map();
  }

  startListeners(onRemoved) {
    onRemoved.addListener(this.removeTab.bind(this));
  }

  getTab(tabId) {
    return this._data.get(tabId);
  }

  hasTab(tabId) {
    return this._data.has(tabId);
  }

  setTab(tabId, value) {
    return this._data.set(tabId, value);
  }

  removeTab(tabId) {
    return this._data.delete(tabId);
  }

  getTabUrl(tabId) {
    try {
      return this.getFrameUrl(tabId, 0);
    } catch(e) {
      return undefined;
    }
  }

  getFrameUrl(tabId, frameId) {
    try {
      return this.getFrame(tabId, frameId).url;
    } catch(e) {
      return undefined;
    }
  }

  getFrame(tabId, frameId) {
    return this.getTab(tabId).get(frameId);
  }

  isThirdParty(tabId, hostname) {
    return isThirdParty(this.getFrame(tabId, 0).urlObj.hostname, hostname);
  }

  hasResource({tabId, frameId, url, type}) {
    try {
      return this.getTab(tabId).get(frameId).hasResource({url, type});
    } catch (e) {
      return false;
    }
  }

  addResource(details) {
    // if new tab, or new main_frame for existing tab
    if (!this.hasTab(details.tabId) || (details.type === 'main_frame')) {
      this.setTab(details.tabId, new Tab(details.tabId));
    }
    let tab = this.getTab(details.tabId);

    // if new frame
    if (!tab.has(details.frameId)) {
      tab.set(details.frameId, new Frame(details));
    }
    let frame = tab.get(details.frameId);

    // add resource to frame
    frame.recordResource(details);

    if (details.parentFrameId === -1) {
      return; // main_frame request
    }
    // add this frame to its parent, but make new parent if it doesn't exist first
    if (!tab.has(details.parentFrameId)) {
      tab.set(details.parentFrameId, new Frame({frameId: details.parentFrameId}));
    }
    tab.get(details.parentFrameId).children.set(frame.id, frame);
  }

  markResponse(response, url, tabId) {
    this.getTab(tabId).markResponse(response, url);
  }
};

Object.assign(exports, {Frame, Tabs, Tab});

})].map(func => typeof exports == 'undefined' ? require.scopes.tabs = func : func(exports));
