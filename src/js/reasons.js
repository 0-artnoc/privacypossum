"use strict";

[(function(exports) {

const {Action} = require('./schemes'),
  {URL} = require('./shim'),
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
  constructor(name, {messageHandler, requestHandler}) {
    Object.assign(this, {name, messageHandler, requestHandler});
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

function userHostDeactivateRequestHandler({tabs}, details) {
  details.shortCircuit = true;
  details.response = NO_ACTION;
  tabs.getTab(details.tabId).action = tabDeactivate;
}

async function onUserHostDeactivate({store}, {url}) {
  let action = new Action({
    reason: constants.USER_HOST_DEACTIVATE,
    href: url});
  await store.updateDomain(url, (domain) => Object.assign(domain, {action}));
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
    funcs: {requestHandler: setResponse(NO_ACTION, true)}
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
class RequestHandler {
  constructor(tabs, store) {
    Object.assign(this, {tabs, store});
    this.funcs = new Map();
    reasons.forEach(reason => {
      this.addReason(reason);
    });
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

class Handler {
  constructor(tabs, store) {
    this.requestHandler = new RequestHandler(tabs, store);
    this.handleRequest = this.requestHandler.handleRequest.bind(this.requestHandler);
  }

  addReason(reason) {
    if (reason.requestHandler) {
      this.requestHandler.addReason(reason);
    }
  }
}

Object.assign(exports, {Handler, tabDeactivate, Reason, reasons});

})].map(func => typeof exports == 'undefined' ? require.scopes.reasons = func : func(exports));
