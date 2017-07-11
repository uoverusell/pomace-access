import { sequence, debug, dateNow } from 'pomace-base';

class Access {

  constructor(opt) {
    this.apiList = {};
    this.options = {};
    this.options.id = opt.id ? opt.id : null,
    this.options.origin = opt.origin ? opt.origin : '';
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

  reset(k, v) {
    if (this.options.hasOwnProperty(k)) {
      if (typeof v === typeof this.options[k]) {
        this.options[k] = v;
      }
    }
  }

  local(data) {
    if (typeof data === 'object') {
      this.options.local = data;
    }
  }

  define(n, option = {}) {
    if (this.apiList.hasOwnProperty(n)) {
      return;
    }

    this.apiList[n] = {
      name: n,
      xhr: new XMLHttpRequest(),
    };

    if (option.alias && !this.apiList.hasOwnProperty(option.alias)) {
      this.apiList[option.alias] = this.apiList[n];
    } else if (option.alias) {
      debug(` access alias "${this.options.alias}" already named..`);
    }
  }

  link(n) {
    if (!this.apiList.hasOwnProperty(n)) {
      return null;
    }

    const options = this.options;
    const api = this.apiList[n];
    const methods = ['GET', 'POST', 'HEAD', 'PUT', 'DELETE'];
    const cache = {};
    const beforeCacheCode = null;

    const iOptions = {
      MIME: null,
    };

    const process = {
      success() {},
      before() {},
      timeout() {},
      abort() {},
      fail() {},
    };

    const linker = {
      JSONP: null,
      MIME(mime) {
        iOptions.mime = mime ? mime : null;
      },
      before(cb) {
        process.before = cb;
      },
      success(cb) {
        process.success = cb;
      },
      fail(cb) {
        process.fail = cb;
      },
      timeout(cb) {
        process.timeout = cb;
      },
      abort(cb) {
        process.abort = cb;
      },
    };

    const cacheCode = (data) => {
      return encodeURIComponent(JSON.stringify(data).replace(/\s{0,}/, ''));
    };

    const setData = (data, request) => {
      if (options.cache) {
        cache[cacheCode(request)] = data;
      }

      return {
        get() {
          return data;
        },
        toText() {
          return data.toString();
        },
        toJson() {
          if (/^\{.+\}$/.test(data)) {
            return JSON.parse(data);
          }
          return data;
        },
        toArray() {
          if (/^\[.+\]$/.test(data)) {
            return JSON.parse(data);
          }
          return data;
        },
      };
    };

    const step = (key, request = null, response = null, cb) => {
      const keyPart = `${key.charAt(0).toUpperCase()}${key.substr(1, key.length)}`;
      const seqList = [];

      seqList.push({
        key: `Access_${key}`,
        doth(p) {
          if (Access[`gReq${`${keyPart}`}`]({
              request,
              response,
              name: n,
              next: () => p.next()
            }) !== false) {
            p.next();
          }
        }
      });

      seqList.push({
        key: `Access_${options.id}_${key}`,
        doth: p => {
          if (this[`req${keyPart}`]({
              request,
              response,
              name: n,
              next: () => p.next()
            }) !== false) {
            p.next();
          }
        }
      });

      seqList.push({
        key: `Access_${options.id}_${n}_${key}`,
        doth: p => {
          if (process[`${key}`]({
              request,
              response,
              name: n,
              next: () => cb && cb({
                  request,
                  response
                })
            }) !== false) {
            cb && cb({
              request,
              response
            });
          }
        }
      });

      sequence(seqList).begin();
    };

    const readyStateChange = (xhr, request) => {

      if (xhr.readyState === xhr.UNSENT) {
        debug(`[access unsent] ${api.name}`);
      }

      if (xhr.readyState === xhr.OPENED) {
        debug(`[access opened] ${api.name}`);
      }

      if (xhr.readyState === xhr.HEADERS_RECEVIED) {
        debug(`[access headers recevied] ${api.name}`);
      }

      if (xhr.readyState === xhr.LOADING) {
        const header = xhr.getAllResponseHeaders();

        debug(`[access loading] ${api.name}, limit time ${options.timeout / 1000}s`);
        readyStateChange.timeoutId = setTimeout(() => {
          xhr.abort();
          step('abort', request, {
            header,
          });
        }, options.timeout);
      }

      if (xhr.readyState === xhr.DONE) {
        const header = xhr.getAllResponseHeaders();

        clearTimeout(readyStateChange.timeoutId);
        debug(`[access done] ${api.name}`);

        if (xhr.status === 200 || xhr.status === 206 || xhr.status === 304) {
          step('success', request, {
            data: setData(xhr.responseText, request),
            header,
          });
        } else {
          step('fail', request, {
            data: setData(xhr.responseText, request),
            header,
          });
        }
      }
    };

    const scriptSend = (ibody = {}, iheader = {}) => {
      const {name} = api;
      const {header, body, local, origin} = options;
      const {gHeader, gBody, gReqBefore, gReqFail} = Access;
      const reqHeader = Object.assign({}, gHeader ? gHeader : {}, header, iheader);
      const reqBody = Object.assign({}, gBody ? gBody : {}, body, ibody);
      const request = Object.assign({}, options, {
        header: reqHeader,
        body: reqBody
      });
      const cacheKey = cacheCode(request);
      const script = document.createElement('script');
      const callbackName = `_call_pomace_jsonp_${n}_${dateNow()}_`;

      window[callbackName] = (data) => {
        readyStateChange({
          responseText: data,
          readyState: 4,
          DONE: 4,
          status: 200,
          getAllResponseHeaders: () => {
          }
        }, request);
      };

      script.onload = () => script.parentNode.removeChild(script);
      script.onerror = () => script.parentNode.removeChild(script);

      step('before', request, null, () => {
        const strReqBody = [
          `callback=${callbackName}`
        ];

        for (const k in reqBody) {
          strReqBody.push(`${k}=${reqBody[k]}`);
        }

        if (options.cache && cache.hasOwnProperty(cacheKey)) {
          if (beforeCacheCode === cacheKey) {
            step('success',
              cache[cacheKey].request,
              {
                data: setData(cache[cacheKey].response, request),
                header: cache[cacheKey].header
              });
          }
        } else {
          const sendData = strReqBody.join('&');

          script.src = `${origin}/${name}${`?${sendData}`}`;
          document.body.appendChild(script);
        }
      });
    };

    const send = (method, ibody = {}, iheader = {}) => {
      const {name, xhr} = api;
      const {header, body, local, origin} = options;
      const {gHeader, gBody, gReqBefore, gReqFail} = Access;
      const reqHeader = Object.assign({}, gHeader ? gHeader : {}, header, iheader);
      const reqBody = Object.assign({}, gBody ? gBody : {}, body, ibody);
      const request = Object.assign({}, options, {
        method,
        header: reqHeader,
        body: reqBody
      });
      const cacheKey = cacheCode(request);

      xhr.onreadystatechange = function() {
        readyStateChange(xhr, request);

        let mime = iOptions.MIME || options.MIME;

        if(xhr.readyState === xhr.OPENED){
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

         for (const k in reqHeader) {
           xhr.setRequestHeader(k, reqHeader[k]);
         }

         if (method !== 'GET') {
          if (method === 'POST' && ['text/xml', 'multipart/form-data', 'application/json'].indexOf(mime) < 0) {
             xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
           }
         }
        }
      };

      step('before', request, null, () => {
        const strReqBody = [];
        let mime = iOptions.MIME || options.MIME;

        for (const k in reqBody) {
          strReqBody.push(`${k}=${reqBody[k]}`);
        }

        if (options.cache && cache.hasOwnProperty(cacheKey)) {
          if (beforeCacheCode === cacheKey) {
            step('success',
              cache[cacheKey].request,
              {
                data: setData(cache[cacheKey].response, request),
                header: cache[cacheKey].header
              });
          }
        } else if (options.local !== null) {
          debug(`[LOCAL DATA] ${name}`);
          step('success',
            request,
            {
              data: setData(!options.local[name] ? '{}' : options.local[name].response, request),
              header: !options.local[name] ? {} : options.local[name].header
            });
        } else {
          let sendData = strReqBody.join('&');

          xhr.open(method, `${origin}/${name}${method === 'GET' ? `?${sendData}` : ''}`);

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

    methods.map(methodName => {
      linker[methodName] = (body, head) => {
        send(methodName, body, head);
      };
    });

    linker.JSONP = (body, head) => {
      scriptSend(body, head);
    };

    return linker;
  }

  resquestTimeout(cb) {
    this.reqTimeout = cb ? cb : (new Function());
  }

  requestBefore(cb) {
    this.reqBefore = cb ? cb : (new Function());
  }

  requestSuccess(cb) {
    this.reqSuccess = cb ? cb : (new Function());
  }

  requestFail(cb) {
    this.reqFail = cb ? cb : (new Function());
  }

  static acrossHeader(header) {
    Access.gHeader = header;
  }

  static acrossBody(body) {
    Access.gBody = body;
  }

  static acrossRequestAbort(cb) {
    Access.gReqAbort = cb ? cb : (new Function());
  }

  static acrossRequestTimeout(cb) {
    Access.gReqTimeout = cb ? cb : (new Function());
  }

  static acrossRequestBefore(cb) {
    Access.gReqBefore = cb ? cb : (new Function());
  }

  static acrossRequestSuccess(cb) {
    Access.gReqSuccess = cb ? cb : (new Function());
  }

  static acrossRequestFail(cb) {
    Access.gReqFail = cb ? cb : (new Function());
  }
}

Access.gHeader = {};
Access.gBody = {};
Access.gReqAbort = new Function();
Access.gReqTimeout = new Function();
Access.gReqBefore = new Function();
Access.gReqSuccess = new Function();
Access.gReqFail = new Function();

export default Access;
