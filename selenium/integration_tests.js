'use strict';

const {assert} = require('chai');

const {newDriver, startApp, stopApp, firstPartyHost} = require('./utils'),
  {cookieApp, fpcookie} = require("./cookies"),
  {etagApp} = require('./etags');

describe('etag tests', function() {
  beforeEach(function() {
    this.app = etagApp();
    this.driver = newDriver();
    startApp(this.app);
  });
  afterEach(function() {
    stopApp(this.app);
    this.driver.quit();
  });
  it('blocks etags', async function() {
    let {app, driver} = this;
    await driver.get('about:blank');
    await driver.get(firstPartyHost);
    await driver.get(firstPartyHost);
    let req1 = await app.firstParty.requests.next(),
      req3 = await app.thirdParty.requests.next();
    assert.isTrue(req1.headers.hasOwnProperty('if-none-match'), 'allows 1st party etags on first visit');
    // known failure on chrome due to lack of access to caching headers in chrome webrquest api
    //assert.isFalse(req3.headers.hasOwnProperty('if-none-match'), 'blocks 3rd party etags headers on first visit');
  });
});

describe('cookie tests', function() {
  beforeEach(function() {
    this.app = cookieApp();
    this.driver = newDriver();
    startApp(this.app);
  });
  afterEach(function() {
    stopApp(this.app);
    this.driver.quit();
  });

  it('blocks cookies', async function() {
    let {app, driver} = this;
    await driver.get(firstPartyHost);
    let request = await app.firstParty.requests.next();
    // no cookies initially
    assert.deepEqual(request.cookies, {});
    request = await app.thirdParty.requests.next();
    assert.deepEqual(request.cookies, {});

    await driver.get(firstPartyHost);
    request = await app.firstParty.requests.next();
    // now we have first party cookies set
    assert.deepEqual(request.cookies, {[fpcookie.name]: fpcookie.value});
    request = await app.thirdParty.requests.next();
    // but not third party cookies
    assert.deepEqual(request.cookies, {});
  });
});
