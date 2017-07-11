'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _pomaceBase = require('pomace-base');

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var Access = function () {
  function Access(opt) {
    _classCallCheck(this, Access);

    this.apiList = {};
    this.options = {};
    this.options.id = opt.id ? opt.id : null, this.options.origin = opt.origin ? opt.origin : '';
    this.options.header = opt.header ? opt.header : {};
    this.options.body = opt.body ? opt.body : {};
    this.options.timeout = opt.timeout ? opt.timeout : 10000;
    this.options.local = opt.local ? opt.local : null;
    this.options.MIME = opt.MIME ? opt.MIME : null;
    this.reqTimeout = new Function();
    this.reqBefore = new Function();
    this.reqSuccess = new Function();
    this.reqFail = new Function();
  }

  _createClass(Access, [{
    key: 'reset',
    value: function reset(k, v) {
      if (this.options.hasOwnProperty(k)) {
        if ((typeof v === 'undefined' ? 'undefined' : _typeof(v)) === _typeof(this.options[k])) {
          this.options[k] = v;
        }
      }
    }
  }, {
    key: 'local',
    value: function local(data) {
      if ((typeof data === 'undefined' ? 'undefined' : _typeof(data)) === 'object') {
        this.options.local = data;
      }
    }
  }, {
    key: 'define',
    value: function define(n) {
      var option = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

      if (this.apiList.hasOwnProperty(n)) {
        return;
      }

      this.apiList[n] = {
        name: n,
        xhr: new XMLHttpRequest()
      };

      if (option.alias && !this.apiList.hasOwnProperty(option.alias)) {
        this.apiList[option.alias] = this.apiList[n];
      } else if (option.alias) {
        (0, _pomaceBase.debug)(' access alias "' + this.options.alias + '" already named..');
      }
    }
  }, {
    key: 'link',
    value: function link(n) {
      var _this = this;

      if (!this.apiList.hasOwnProperty(n)) {
        return null;
      }

      var options = this.options;
      var api = this.apiList[n];
      var methods = ['GET', 'POST', 'HEAD', 'PUT', 'DELETE'];
      var cache = {};
      var beforeCacheCode = null;

      var iOptions = {
        MIME: null
      };

      var process = {
        success: function success() {},
        before: function before() {},
        timeout: function timeout() {},
        abort: function abort() {},
        fail: function fail() {}
      };

      var linker = {
        JSONP: null,
        MIME: function MIME(mime) {
          iOptions.mime = mime ? mime : null;
        },
        before: function before(cb) {
          process.before = cb;
        },
        success: function success(cb) {
          process.success = cb;
        },
        fail: function fail(cb) {
          process.fail = cb;
        },
        timeout: function timeout(cb) {
          process.timeout = cb;
        },
        abort: function abort(cb) {
          process.abort = cb;
        }
      };

      var cacheCode = function cacheCode(data) {
        return encodeURIComponent(JSON.stringify(data).replace(/\s{0,}/, ''));
      };

      var setData = function setData(data, request) {
        if (options.cache) {
          cache[cacheCode(request)] = data;
        }

        return {
          get: function get() {
            return data;
          },
          toText: function toText() {
            return data.toString();
          },
          toJson: function toJson() {
            if (/^\{.+\}$/.test(data)) {
              return JSON.parse(data);
            }
            return data;
          },
          toArray: function toArray() {
            if (/^\[.+\]$/.test(data)) {
              return JSON.parse(data);
            }
            return data;
          }
        };
      };

      var step = function step(key) {
        var request = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;
        var response = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : null;
        var cb = arguments[3];

        var keyPart = '' + key.charAt(0).toUpperCase() + key.substr(1, key.length);
        var seqList = [];

        seqList.push({
          key: 'Access_' + key,
          doth: function doth(p) {
            if (Access['gReq' + ('' + keyPart)]({
              request: request,
              response: response,
              name: n,
              next: function next() {
                return p.next();
              }
            }) !== false) {
              p.next();
            }
          }
        });

        seqList.push({
          key: 'Access_' + options.id + '_' + key,
          doth: function doth(p) {
            if (_this['req' + keyPart]({
              request: request,
              response: response,
              name: n,
              next: function next() {
                return p.next();
              }
            }) !== false) {
              p.next();
            }
          }
        });

        seqList.push({
          key: 'Access_' + options.id + '_' + n + '_' + key,
          doth: function doth(p) {
            if (process['' + key]({
              request: request,
              response: response,
              name: n,
              next: function next() {
                return cb && cb({
                  request: request,
                  response: response
                });
              }
            }) !== false) {
              cb && cb({
                request: request,
                response: response
              });
            }
          }
        });

        (0, _pomaceBase.sequence)(seqList).begin();
      };

      var readyStateChange = function readyStateChange(xhr, request) {

        if (xhr.readyState === xhr.UNSENT) {
          (0, _pomaceBase.debug)('[access unsent] ' + api.name);
        }

        if (xhr.readyState === xhr.OPENED) {
          (0, _pomaceBase.debug)('[access opened] ' + api.name);
        }

        if (xhr.readyState === xhr.HEADERS_RECEVIED) {
          (0, _pomaceBase.debug)('[access headers recevied] ' + api.name);
        }

        if (xhr.readyState === xhr.LOADING) {
          (function () {
            var header = xhr.getAllResponseHeaders();

            (0, _pomaceBase.debug)('[access loading] ' + api.name + ', limit time ' + options.timeout / 1000 + 's');
            readyStateChange.timeoutId = setTimeout(function () {
              xhr.abort();
              step('abort', request, {
                header: header
              });
            }, options.timeout);
          })();
        }

        if (xhr.readyState === xhr.DONE) {
          var _header = xhr.getAllResponseHeaders();

          clearTimeout(readyStateChange.timeoutId);
          (0, _pomaceBase.debug)('[access done] ' + api.name);

          if (xhr.status === 200 || xhr.status === 206 || xhr.status === 304) {
            step('success', request, {
              data: setData(xhr.responseText, request),
              header: _header
            });
          } else {
            step('fail', request, {
              data: setData(xhr.responseText, request),
              header: _header
            });
          }
        }
      };

      var scriptSend = function scriptSend() {
        var ibody = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
        var iheader = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
        var name = api.name;
        var header = options.header,
            body = options.body,
            local = options.local,
            origin = options.origin;
        var gHeader = Access.gHeader,
            gBody = Access.gBody,
            gReqBefore = Access.gReqBefore,
            gReqFail = Access.gReqFail;

        var reqHeader = _extends({}, gHeader ? gHeader : {}, header, iheader);
        var reqBody = _extends({}, gBody ? gBody : {}, body, ibody);
        var request = _extends({}, options, {
          header: reqHeader,
          body: reqBody
        });
        var cacheKey = cacheCode(request);
        var script = document.createElement('script');
        var callbackName = '_call_pomace_jsonp_' + n + '_' + (0, _pomaceBase.dateNow)() + '_';

        window[callbackName] = function (data) {
          readyStateChange({
            responseText: data,
            readyState: 4,
            DONE: 4,
            status: 200,
            getAllResponseHeaders: function getAllResponseHeaders() {}
          }, request);
        };

        script.onload = function () {
          return script.parentNode.removeChild(script);
        };
        script.onerror = function () {
          return script.parentNode.removeChild(script);
        };

        step('before', request, null, function () {
          var strReqBody = ['callback=' + callbackName];

          for (var k in reqBody) {
            strReqBody.push(k + '=' + reqBody[k]);
          }

          if (options.cache && cache.hasOwnProperty(cacheKey)) {
            if (beforeCacheCode === cacheKey) {
              step('success', cache[cacheKey].request, {
                data: setData(cache[cacheKey].response, request),
                header: cache[cacheKey].header
              });
            }
          } else {
            var sendData = strReqBody.join('&');

            script.src = origin + '/' + name + ('?' + sendData);
            document.body.appendChild(script);
          }
        });
      };

      var send = function send(method) {
        var ibody = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
        var iheader = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
        var name = api.name,
            xhr = api.xhr;
        var header = options.header,
            body = options.body,
            local = options.local,
            origin = options.origin;
        var gHeader = Access.gHeader,
            gBody = Access.gBody,
            gReqBefore = Access.gReqBefore,
            gReqFail = Access.gReqFail;

        var reqHeader = _extends({}, gHeader ? gHeader : {}, header, iheader);
        var reqBody = _extends({}, gBody ? gBody : {}, body, ibody);
        var request = _extends({}, options, {
          method: method,
          header: reqHeader,
          body: reqBody
        });
        var cacheKey = cacheCode(request);

        xhr.onreadystatechange = function () {
          readyStateChange(xhr, request);

          var mime = iOptions.MIME || options.MIME;

          if (xhr.readyState === xhr.OPENED) {
            if (method === 'GET' && mime && mime.indexOf('application/json') >= 0) {
              mime = null;
            }

            if (mime) {
              if (xhr.overrideMimeType) {
                xhr.overrideMimeType(mime);
              }
              xhr.setRequestHeader('Content-Type', mime);
            }

            iOptions.MIME = null;

            for (var k in reqHeader) {
              xhr.setRequestHeader(k, reqHeader[k]);
            }

            if (method !== 'GET') {
              if (method === 'POST' && ['text/xml', 'multipart/form-data', 'application/json'].indexOf(mime) < 0) {
                xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
              }
            }
          }
        };

        step('before', request, null, function () {
          var strReqBody = [];
          var mime = iOptions.MIME || options.MIME;

          for (var k in reqBody) {
            strReqBody.push(k + '=' + reqBody[k]);
          }

          if (options.cache && cache.hasOwnProperty(cacheKey)) {
            if (beforeCacheCode === cacheKey) {
              step('success', cache[cacheKey].request, {
                data: setData(cache[cacheKey].response, request),
                header: cache[cacheKey].header
              });
            }
          } else if (options.local !== null) {
            (0, _pomaceBase.debug)('[LOCAL DATA] ' + name);
            step('success', request, {
              data: setData(!options.local[name] ? '{}' : options.local[name].response, request),
              header: !options.local[name] ? {} : options.local[name].header
            });
          } else {
            var sendData = strReqBody.join('&');

            xhr.open(method, origin + '/' + name + (method === 'GET' ? '?' + sendData : ''));

            if (method === 'GET' && mime && mime.indexOf('application/json') >= 0) {
              mime = null;
            }

            if (method !== 'GET') {
              if (mime && mime.indexOf('application/json') >= 0) {
                sendData = JSON.stringify(reqBody);
              }
            }

            if (options.cross) {
              xhr.withCredentials = options.cross;
            }

            xhr.send(method === 'GET' ? null : sendData);
          }
        });
      };

      methods.map(function (methodName) {
        linker[methodName] = function (body, head) {
          send(methodName, body, head);
        };
      });

      linker.JSONP = function (body, head) {
        scriptSend(body, head);
      };

      return linker;
    }
  }, {
    key: 'resquestTimeout',
    value: function resquestTimeout(cb) {
      this.reqTimeout = cb ? cb : new Function();
    }
  }, {
    key: 'requestBefore',
    value: function requestBefore(cb) {
      this.reqBefore = cb ? cb : new Function();
    }
  }, {
    key: 'requestSuccess',
    value: function requestSuccess(cb) {
      this.reqSuccess = cb ? cb : new Function();
    }
  }, {
    key: 'requestFail',
    value: function requestFail(cb) {
      this.reqFail = cb ? cb : new Function();
    }
  }], [{
    key: 'acrossHeader',
    value: function acrossHeader(header) {
      Access.gHeader = header;
    }
  }, {
    key: 'acrossBody',
    value: function acrossBody(body) {
      Access.gBody = body;
    }
  }, {
    key: 'acrossRequestAbort',
    value: function acrossRequestAbort(cb) {
      Access.gReqAbort = cb ? cb : new Function();
    }
  }, {
    key: 'acrossRequestTimeout',
    value: function acrossRequestTimeout(cb) {
      Access.gReqTimeout = cb ? cb : new Function();
    }
  }, {
    key: 'acrossRequestBefore',
    value: function acrossRequestBefore(cb) {
      Access.gReqBefore = cb ? cb : new Function();
    }
  }, {
    key: 'acrossRequestSuccess',
    value: function acrossRequestSuccess(cb) {
      Access.gReqSuccess = cb ? cb : new Function();
    }
  }, {
    key: 'acrossRequestFail',
    value: function acrossRequestFail(cb) {
      Access.gReqFail = cb ? cb : new Function();
    }
  }]);

  return Access;
}();

Access.gHeader = {};
Access.gBody = {};
Access.gReqAbort = new Function();
Access.gReqTimeout = new Function();
Access.gReqBefore = new Function();
Access.gReqSuccess = new Function();
Access.gReqFail = new Function();

exports.default = Access;