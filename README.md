# cudcache

cudcache is a quick and simple JavaScript library for caching POST, PUT, and DELETE requests made when your app is offline. cudcache makes it easier to provide a comprehensive PWA experience for your users. cudcache relies on [localforage](https://github.com/localForage/localForage) for storage.

# How to use cudcache

CUD provides a set of methods that wrap your post, delete, and put requests. Before sending the request, CUD tests the quality of the user's internet connection. If that test fails, CUD stores the request and associated data and sets an interval to re-check whether the user has regained connection. If so, all requests are processed atomically, i.e. if one fails they all fail. After successfully completing CUD clears the cache and the interval.

## The Request Object

The request object is a parcel of data that enables CUD to make that request or pocket it for later. That request object will look something like this:
```javascript
const requestObj = {
  url: 'https://example.com/createEvent',
  data: {
    title: 'Oh great another event',
    author: 'Anon'
  },
  headers: [{ name: 'Accept', value: 'application/json' }]
}
```

Not too painful! Then, just call cudcache.post(requestObj), cudcache.put(requestObj), or cudcache.del(requestObj). cudcache will take care of the rest.

You can call cudcache.init(options) with an options object as well. Options available at the moment for configuring your instance of cudcache:

Property name | Property type | Notes
------------- |  ------------- |  -----
networkTimeout | Integer | A number in milliseconds that will set the threshold to wait for network response before caching request. Defaults to 4000.
testConnectionURL | String | URL to test for network connectivity. Defaults to 'https://api.coinranking.com/v1/public/coins'.
unloadRequestsFailure | Function | Callback that executes if CUD tried to unload cached requests but failed.
unloadRequestsSuccess | Function | Callback that executes if CUD tried to unload cached requests and succeeded.
checkConnectionInterval | Integer | Number in milliseconds that dictates how long CUD should wait before trying to unload cached requests again. Defaults to 10000.
batchCachedRequests | Boolean | Flag to designate whether cached requests should process atomically or not. Defaults to true.


<!-- [build-badge]: https://img.shields.io/travis/user/repo/master.png?style=flat-square
[build]: https://travis-ci.org/user/repo -->

[npm-badge]: https://img.shields.io/npm/v/npm-package.png?style=flat-square
[npm]: https://www.npmjs.org/package/cudcache

<!-- [coveralls-badge]: https://img.shields.io/coveralls/user/repo/master.png?style=flat-square
[coveralls]: https://coveralls.io/github/user/repo -->
