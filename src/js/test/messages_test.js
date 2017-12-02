"use strict";

const assert = require('chai').assert,
  constants = require('../constants'),
  {URL, onMessage, sendMessage} = require('../shim'),
  {Tabs} = require('../tabs'),
  {DomainStore} = require('../store'),
  {Action} = require('../schemes'),
  {MessageDispatcher, onFingerPrinting, onUserUrlDeactivate,
    onUserHostDeactivate} = require('../messages'),
  {Mock, Details, details} = require('./testing_utils');

describe('messages.js', function() {
  describe('MessageDispatcher', function() {
    beforeEach(function() {
      this.tabs = new Tabs();
      this.store = new DomainStore('name');
      this.ml = new MessageDispatcher(
        this.tabs,
        this.store,
      );
    });

    describe('#onMessage', function() {
      it('dispatches messages', function() {
        let func = new Mock(),
          type = 'test msg';

        this.ml.start(onMessage);
        this.ml.addListener(type, func);

        sendMessage({type});
        assert.isTrue(func.called);
      })
    })

    describe('Deactivate', function() {
      let {href} = new URL(details.script.url),
        response = constants.NO_ACTION,
        urlAction = new Action({reason: constants.USER_URL_DEACTIVATE, href, response}),
        hostAction = new Action({reason: constants.USER_HOST_DEACTIVATE, href, response});

      it('url deactivate updates storage', async function() {
        await onUserUrlDeactivate({store: this.store}, {url: href}, undefined);
        let path = this.ml.store.getDomainPath(href);
        assert.deepEqual(path.action, urlAction);
      });

      it('host deactivate updates storage', async function() {
        await onUserHostDeactivate({store: this.store}, {url: href}, undefined);
        let domain = this.ml.store.getDomain(href);
        assert.deepEqual(domain.action, hostAction);
      });
    });

    describe('#onFingerPrinting', function() {
      let url = new URL(details.script.url),
        message = {url: url.href},
        action = new Action({
          response: constants.CANCEL,
          reason: constants.FINGERPRINTING,
          href: url.href,
          frameUrl: undefined,
          tabUrl: undefined,
        });

      beforeEach(async function() {
        this.ml.tabs.addResource(details.script); // add the resource
        await onFingerPrinting({store: this.store, tabs: this.tabs},
          message, details.script.toSender());
      });

      it('updates storage', async function() {
        let domain = await this.ml.store.getDomain(url.href);
        assert.isTrue(domain.paths.hasOwnProperty(url.pathname), 'path set on domain');

        let path = domain.paths[url.pathname];
        assert.deepEqual(path.action.response, constants.CANCEL, 'correct response is set');

        assert.deepEqual(path.action, action, 'correct action set');
      })

      it('adds a second path', async function() {
        let url2 = new URL(details.script.url);
        url2.pathname = '/otherpath.js';

        let details2 = new Details(Object.assign({}, details.script, {url: url2.href}))

        this.ml.tabs.addResource(details2); // add the resource
        await onFingerPrinting({store: this.store, tabs: this.tabs},
          {url: details2.url}, details2.toSender());

        let domain = await this.ml.store.getDomain(url2.href);
        assert.isTrue(domain.paths.hasOwnProperty(url2.pathname), 'path set on domain');

        let path = domain.paths[url2.pathname];
        assert.deepEqual(path.action.response, constants.CANCEL, 'correct response is set');

        let action2 = new Action(Object.assign({}, action, {href: url2.href}));

        assert.deepEqual(path.action, action2, 'correct action set');
      });

      it('rejects unknown resources', async function() {
        let details2 = new Details(Object.assign({}, details.script, {url: 'https://other.com/foo.js'}));
        await onFingerPrinting({store: this.store, tabs: this.tabs},
          {url: details2.url}, details2.toSender());
        assert.isUndefined(await this.ml.store.getDomain(details2.url), 'no domain gets set');
      });
    });
  });
});
