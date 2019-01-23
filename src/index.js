import superagent from 'superagent';
import localforage from 'localforage';

let instance = null;

const testConnection = ({ networkTimeout, testConnectionURL }) => {
  const now = Date.now();
  return superagent.get(`${testConnectionURL}?t=${now}`).timeout({ response: networkTimeout });
};

const createPromise = (requestType, data) => {
  return new Promise((resolve, reject) => {
    const request = data ? requestType.send(data) : requestType.send();
    return request.then((res) => {
      resolve(res);
    }).catch((err) => {
      reject(err);
    });
  });
};

const noop = () => null;

const DEFAULT_OPTS = {
  networkTimeout: 4000,
  testConnectionURL: 'https://api.coinranking.com/v1/public/coins',
  unloadRequestsFailure: noop,
  unloadRequestsSuccess: noop,
  checkConnectionInterval: 10000,
  batchCachedRequests: true
};

const setOpts = (opts, context) => {
  const {
    networkTimeout,
    testConnectionURL,
    checkConnectionInterval,
    batchCachedRequests,
    unloadRequestsFailure,
    unloadRequestsSuccess
  } = opts;
  context.networkTimeout = networkTimeout || context.networkTimeout;
  context.testConnectionURL = testConnectionURL || context.testConnectionURL;
  context.batchCachedRequests = batchCachedRequests || context.batchCachedRequests;
  context.unloadRequestsFailure = unloadRequestsFailure || context.unloadRequestsFailure;
  context.unloadRequestsSuccess = unloadRequestsSuccess || context.unloadRequestsSuccess;
  context.checkConnectionInterval = checkConnectionInterval || context.checkConnectionInterval;
};

const setPollingInterval = (context) => {
  let pollingInterval = null;
  return function() {
    clearInterval(pollingInterval);
    pollingInterval = setInterval(() => {
      testConnection({ networkTimeout: context.networkTimeout, testConnectionURL: context.testConnectionURL }).then((res, err) => {
        context.unloadRequests();
      }).catch((err) => {
        console.warn('Connection is not great!');
      });
    }, context.checkConnectionInterval || 1000);
  }
};

class Postcache {
  constructor(opts) {
    this.initialized = false;
    setOpts(opts, this);
    localforage.config({
      name: 'postcache',
      storeName: 'requests'
    });
  }
  init(opts = {}) {
    if (!this.initialized) {
      setOpts(opts, this)
      this.setPollingInterval = setPollingInterval(this);
      this.setPollingInterval();
      this.initialized = true;
      Object.freeze(this);
      return this;
    } else {
      throw new Error('You have already initialized Postcache');
    }
  }
  makeRequest(request) {
    const { type, data, headers, url } = request;
    const requestType = superagent[type.toLowerCase()](url);
    if (headers && headers.length) {
      headers.forEach((header) => {
        const { name, value } = header;
        requestType.set(name, value);
      });
    }
    if (data && Object.keys(data).length) {
      return createPromise(requestType, data);
    } else {
      return createPromise(requestType);
    }
  }
  makeoOrCacheRequest(requestObj, requestType) {
    const { url, data } = requestObj;
    let requestObjClone = JSON.parse(JSON.stringify(requestObj));
    requestObjClone.type = requestType;
    if (!url) {
      throw new Error('Please supply a url for your post request');
    }
    const { networkTimeout, testConnectionURL } = this;
    return testConnection({ networkTimeout, testConnectionURL }).then((res) => {
      return this.makeRequest(requestObjClone).then((response) => {
        return response;
      })
    }).catch(() => {
      return this.cacheRequest(requestObjClone);
    });
  }
  post(requestObj) {
    return this.makeoOrCacheRequest(requestObj, 'post');
  }
  put(requestObj) {
    return this.makeoOrCacheRequest(requestObj, 'put');
  }
  delete(requestObj) {
    return this.makeoOrCacheRequest(requestObj, 'del');
  }
  cacheRequest(requestObj) {
    return localforage.getItem('requests').then((requests) => {
      if (!requests) {
        return localforage.setItem('requests', [requestObj]).then(() => {
          return { message: 'requests were cached', requests: [requestObj], requestCached: true };
        });
      } else {
        requests.push(requestObj);
        return localforage.setItem('requests', requests).then(() => {
          return { message: 'requests were cached', requests, requestCached: true };
        });
      }
    });
  }
  unloadRequests() {
    const { batchCachedRequests, unloadRequestsSuccess, unloadRequestsFailure } = this;
    localforage.getItem('requests').then((requests) => {
      this.setPollingInterval();
      if (requests) {
        if (batchCachedRequests) {
          const requestPromises = requests.map((request) => this.makeRequest(request));
          Promise.all(requestPromises).then((values) => {
            localforage.removeItem('requests').then(() => {
              this.setPollingInterval();
            });
            unloadRequestsSuccess(values);
          }).catch((err) => {
            this.setPollingInterval();
            unloadRequestsFailure(err);
          });
        }
      }
    });
  }
};

const postcacheSingleton = new Postcache(DEFAULT_OPTS);

export default postcacheSingleton;
