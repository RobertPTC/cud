import superagent from 'superagent';
import localforage from 'localforage';

const testConnection = ({ networkTimeout, testConnectionURL }) => {
  const now = Date.now();
  return superagent.get(`${testConnectionURL}?t=${now}`).timeout({ response: networkTimeout });
};

const createPromise = (requestType, data) => {
  return new Promise((resolve, reject) => {
    const request = data ? requestType.send(data) : requestType.send();
    request.then((res) => {
      resolve(res);
    }).catch((err) => {
      reject(err);
    });
  });
};

const noop = () => null;

class Postcache {
  constructor(opts) {
    const {
      networkTimeout,
      testConnectionURL,
      checkConnectionInterval,
      batchCachedRequests,
      unloadRequestsFailure,
      unloadRequestsSuccess
    } = opts;
    this.networkTimeout = networkTimeout || 4000;
    this.testConnectionURL = testConnectionURL || 'https://api.coinranking.com/v1/public/coins';
    this.batchCachedRequests = batchCachedRequests || true;
    this.unloadRequestsFailure = unloadRequestsFailure || noop;
    this.unloadRequestsSuccess = unloadRequestsSuccess || noop;
    this.checkConnectionInterval = checkConnectionInterval || 10000;
    localforage.config({
      name: 'postcache',
      storeName: 'requests'
    });
    this.setPollingInterval();
  }
  setPollingInterval() {
    this.pollingInterval = setInterval(() => {
      testConnection({ networkTimeout: this.networkTimeout, testConnectionURL: this.testConnectionURL }).then((res, err) => {
        this.unloadRequests();
      }).catch((err) => {
        console.warn('Connection is not great!');
      });
    }, this.checkConnectionInterval || 10000);
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
    testConnection({ networkTimeout, testConnectionURL }).then((res) => {
      makeRequest(requestObjClone).then((response) => {
        return response;
      })
    }).catch(() => {
      this.cacheRequest(requestObjClone);
    });
  }
  post(requestObj) {
    this.makeoOrCacheRequest(requestObj, 'post');
  }
  put(requestObj) {
    this.makeoOrCacheRequest(requestObj, 'put');
  }
  delete(requestObj) {
    this.makeoOrCacheRequest(requestObj, 'del');
  }
  cacheRequest(requestObj) {
    localforage.getItem('requests').then((requests) => {
      if (!requests) {
        localforage.setItem('requests', [requestObj]);
      } else {
        requests.push(requestObj);
        localforage.setItem('requests', requests);
      }
    });
  }
  unloadRequests() {
    const { batchCachedRequests, unloadRequestsSuccess, unloadRequestsFailure } = this;
    clearInterval(this.pollingInterval);
    localforage.getItem('requests').then((requests) => {
      if (requests) {
        if (batchCachedRequests) {
          const requestPromises = requests.map((request) => this.makeRequest(request));
          Promise.all(requestPromises).then((values) => {
            localforage.removeItem('requests').then(() => {
              this.setPollingInterval();
            });
            unloadRequestsSuccess(values);
          }).catch((err) => {
            console.log('all promises err ', err);
            this.setPollingInterval();
            unloadRequestsFailure(err);
          });
        }
      }
    });
  }
};

export default Postcache;
