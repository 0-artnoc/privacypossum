"use strict";

[(function(exports) {

const {Action} = require('./schemes'),
  {URL, onUpdated} = require('./shim'),
  {setTabIconActive, hasAction} = require('./utils'),
  constants = require('./constants');

const {NO_ACTION, CANCEL, FINGERPRINTING, USER_URL_DEACTIVATE,
    USER_HOST_DEACTIVATE, TAB_DEACTIVATE} = constants;

function setResponse(response, shortCircuit) {
  return ({}, details) => Object.assign(details, {response, shortCircuit});
}

/**
 * `name` is the string name of this reasons, see constants.reasons.*
 * `messageHandler` function with signature ({store, tabs}, message, sender)
 * `requestHandler` function with signature ({store, tabs}, details)
 */
class Reason {
  constructor(name, {messageHandler, requestHandler, tabHandler}) {
    Object.assign(this, {name, messageHandler, requestHandler, tabHandler});
  }
}

const tabDeactivate = new Action({reason: TAB_DEACTIVATE});

async function onFingerPrinting({store, tabs}, message, sender) {
  let tabId = sender.tab.id,
    {frameId} = sender,
    {url} = message,
    type = 'script';

  // NB: the url could be dangerous user input, so we check it is an existing resource.
  if (tabs.hasResource({tabId, frameId, url, type})) {
    let reason = constants.FINGERPRINTING,
      frameUrl = tabs.getFrameUrl(tabId, frameId),
      tabUrl = tabs.getTabUrl(sender.tab.id),
      {href} = new URL(url);

    let action = new Action({reason, href, frameUrl, tabUrl});
    tabs.markResponse(CANCEL, href, sender.tab.id);
    await store.setDomainPath(href, action);
  }
}

async function onUserUrlDeactivate({store}, {url}) {
  let action = new Action({
    reason: constants.USER_URL_DEACTIVATE,
    href: url});
  await store.setDomainPath(url, action);
}

function setActiveState(possumTab, active) {
  if (possumTab.active === active) {
    return;
  }
  toggleActiveState(possumTab);
}

function toggleActiveState(possumTab) {
  if (hasAction(possumTab, constants.TAB_DEACTIVATE)) {
    possumTab.setActiveState(true);
    delete possumTab.action;
  } else {
    possumTab.setActiveState(false);
    possumTab.action = tabDeactivate;
  }
}

function userHostDeactivateRequestHandler({tabs}, details) {
  details.shortCircuit = true;
  details.response = NO_ACTION;
  setActiveState(tabs.getTab(details.tabId), false);
}

async function onUserHostDeactivate({tabs, store}, {tabId}) {
  let active,
    url = new URL(tabs.getTabUrl(tabId));
  await store.updateDomain(url.href, (domain) => {
    if (hasAction(domain, constants.USER_HOST_DEACTIVATE)) {
      active = true;
      delete domain.action
    } else {
      active = false;
      Object.assign(domain, {
        action: new Action({
          reason: constants.USER_HOST_DEACTIVATE,
          href: url.href,
        }),
      });
    }
    return domain;
  });
  return setActiveState(tabs.getTab(tabId), active);
}

const reasons = [
  {
    name: FINGERPRINTING,
    funcs: {
      requestHandler: setResponse(CANCEL, false),
      messageHandler: onFingerPrinting,
    },
  },
  {
    name: USER_URL_DEACTIVATE,
    funcs: {
      requestHandler: setResponse(NO_ACTION, false),
      messageHandler: onUserUrlDeactivate,
    },
  },
  {
    name: TAB_DEACTIVATE,
    funcs: {
      requestHandler: setResponse(NO_ACTION, true),
      tabHandler: ({}, {tab}) => {
        setTabIconActive(tab.id, !!tab.active);
      },
    },
  },
  {
    name: USER_HOST_DEACTIVATE,
    funcs: {
      requestHandler: userHostDeactivateRequestHandler,
      messageHandler: onUserHostDeactivate,
    },
  },
].map(({name, funcs}) => new Reason(name, funcs));

// todo wrap handler requests to assure main_frame's are not blocked.
// todo make a handler mixin
class RequestHandler {
  constructor(tabs, store) {
    Object.assign(this, {tabs, store});
    this.funcs = new Map();
  }

  handleRequest(obj, details) {
    if (obj.hasOwnProperty('action')) {
      this.funcs.get(obj.action.reason)(details);
    }
  }

  addReason(reason) {
    this.funcs.set(reason.name,
      reason.requestHandler.bind(undefined, {tabs: this.tabs, store: this.store}));
  }
}

class TabHandler {
  constructor(tabs, store) {
    Object.assign(this, {tabs, store});
    this.funcs = new Map();
  }

  startListeners() {
    onUpdated.addListener(this.handleUpdated.bind(this));
  }

  handleUpdated(tabId, info) {
    if (this.tabs.hasTab(tabId)) {
      let tab = this.tabs.getTab(tabId);
      if (tab.hasOwnProperty('action')) {
        return this.funcs.get(tab.action.reason)({tab, info});
      }
    }
  }

  addReason(reason) {
    this.funcs.set(reason.name,
      reason.tabHandler.bind(undefined, {tabs: this.tabs, store: this.store}));
  }
}


class Handler {
  constructor(tabs, store) {
    this.requestHandler = new RequestHandler(tabs, store);
    this.handleRequest = this.requestHandler.handleRequest.bind(this.requestHandler);

    this.tabHandler = new TabHandler(tabs, store);
    this.tabHandler.startListeners();

    reasons.forEach(reason => {
      this.addReason(reason);
    });
  }

  addReason(reason) {
    if (reason.requestHandler) {
      this.requestHandler.addReason(reason);
    }
    if (reason.tabHandler) {
      this.tabHandler.addReason(reason);
    }
  }
}

Object.assign(exports, {TabHandler, Handler, tabDeactivate, Reason, reasons});

})].map(func => typeof exports == 'undefined' ? require.scopes.reasons = func : func(exports));
