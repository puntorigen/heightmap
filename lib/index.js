(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
  typeof define === 'function' && define.amd ? define(factory) :
  (global = typeof globalThis !== 'undefined' ? globalThis : global || self, global.heightmap = factory());
}(this, (function () { 'use strict';

  function ownKeys(object, enumerableOnly) {
    var keys = Object.keys(object);

    if (Object.getOwnPropertySymbols) {
      var symbols = Object.getOwnPropertySymbols(object);

      if (enumerableOnly) {
        symbols = symbols.filter(function (sym) {
          return Object.getOwnPropertyDescriptor(object, sym).enumerable;
        });
      }

      keys.push.apply(keys, symbols);
    }

    return keys;
  }

  function _objectSpread2(target) {
    for (var i = 1; i < arguments.length; i++) {
      var source = arguments[i] != null ? arguments[i] : {};

      if (i % 2) {
        ownKeys(Object(source), true).forEach(function (key) {
          _defineProperty(target, key, source[key]);
        });
      } else if (Object.getOwnPropertyDescriptors) {
        Object.defineProperties(target, Object.getOwnPropertyDescriptors(source));
      } else {
        ownKeys(Object(source)).forEach(function (key) {
          Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key));
        });
      }
    }

    return target;
  }

  function asyncGeneratorStep(gen, resolve, reject, _next, _throw, key, arg) {
    try {
      var info = gen[key](arg);
      var value = info.value;
    } catch (error) {
      reject(error);
      return;
    }

    if (info.done) {
      resolve(value);
    } else {
      Promise.resolve(value).then(_next, _throw);
    }
  }

  function _asyncToGenerator(fn) {
    return function () {
      var self = this,
          args = arguments;
      return new Promise(function (resolve, reject) {
        var gen = fn.apply(self, args);

        function _next(value) {
          asyncGeneratorStep(gen, resolve, reject, _next, _throw, "next", value);
        }

        function _throw(err) {
          asyncGeneratorStep(gen, resolve, reject, _next, _throw, "throw", err);
        }

        _next(undefined);
      });
    };
  }

  function _defineProperty(obj, key, value) {
    if (key in obj) {
      Object.defineProperty(obj, key, {
        value: value,
        enumerable: true,
        configurable: true,
        writable: true
      });
    } else {
      obj[key] = value;
    }

    return obj;
  }

  /**
   * Heightmap: A class for freely creating a heightmap from a given latitude/longitude point, precision sample and horizon distance.
   * @name 	heightmap
   * @module 	heightmap
   **/
  class heightmap {
    constructor() {
      var config = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
      var defaults = {
        lat: -1,
        lng: -1,
        precision: 200,
        distance: 20
      };
      this.config = _objectSpread2(_objectSpread2({}, defaults), config);
      this.config.distance = this.config.distance * 1000; //transform to meters 
    }

    getBoundingBox() {
      var _this = this;

      return _asyncToGenerator(function* () {
        //step 1
        var geolib = require('geolib');

        var box = {
          topLeft: -1,
          topRight: -1,
          bottomLeft: -1,
          bottomRight: -1,
          polygon: []
        };
        box.topRight = geolib.computeDestinationPoint({
          latitude: _this.config.lat,
          longitude: _this.config.lng
        }, _this.config.distance, 45);
        box.bottomRight = geolib.computeDestinationPoint({
          latitude: _this.config.lat,
          longitude: _this.config.lng
        }, _this.config.distance, 45 * 3);
        box.bottomLeft = geolib.computeDestinationPoint({
          latitude: _this.config.lat,
          longitude: _this.config.lng
        }, _this.config.distance, 45 * 5);
        box.topLeft = geolib.computeDestinationPoint({
          latitude: _this.config.lat,
          longitude: _this.config.lng
        }, _this.config.distance, 45 * 7);
        box.polygon.push(box.topLeft);
        box.polygon.push(box.topRight);
        box.polygon.push(box.bottomRight);
        box.polygon.push(box.bottomLeft);
        return box;
      })();
    }

    getStepValue(box) {
      var _this2 = this;

      return _asyncToGenerator(function* () {
        //step 2
        var geolib = require('geolib');

        var distance = geolib.getDistance(box.topLeft, box.topRight); //in mts

        return Math.ceil(distance / _this2.config.precision); //meters for each step
      })();
    }

    get2D_meshgrid(box) {
      var _this3 = this;

      return _asyncToGenerator(function* () {
        //step 3
        var geolib = require('geolib');

        var steps = yield _this3.getStepValue(box);
        var array2D = [];
        var range = Array(steps).fill(0);

        for (var y in range) {
          var row = [];
          var row_position = geolib.computeDestinationPoint(box.topLeft, _this3.config.precision * y, 180);

          for (var x in range) {
            var tmp = geolib.computeDestinationPoint(row_position, _this3.config.precision * x, 90);
            row.push(tmp);
          }

          array2D.push(row);
        }

        console.log('debug:', {
          steps,
          rows: array2D.length,
          cols: array2D[0].length
        });
        return array2D;
      })();
    }

    getElevation(grid2d) {
      return _asyncToGenerator(function* () {
        //step 4
        //transform grid2d array into single array (flat)
        var axios = require('axios');

        JSON.parse(JSON.stringify(grid2d)); //make a clone
        // 3-sep-21 it seems its too large to send everything...

        /* let grid1d = [].concat.apply([], grid2d);
        let data = { "locations":grid1d };
        let elevation = await axios.post('https://api.open-elevation.com/api/v1/lookup', data, {
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        });*/
        //requesting each row elevation ...

        var service = 'https://api.open-elevation.com/api/v1/lookup';
        var config = {
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        };
        var parallel = [];

        for (var row in grid2d) {
          var data = {
            "locations": grid2d[row]
          }; //console.log('requesting row:'+(row+1)+' of '+grid2d.length);

          var elevation = axios.post(service, data, config);
          parallel.push(elevation); //grid2d[row] = elevation.data.results;
          //break;
        }

        var callthem = yield Promise.all(parallel); // assign results

        for (var _row in callthem) {
          grid2d[_row] = callthem[_row].data.results;
        } //
        //console.log('total_records',total_records.length);


        return grid2d;
      })();
    }

    runTest() {
      var _this4 = this;

      return _asyncToGenerator(function* () {
        var time_start = process.hrtime();
        _this4.config.lat = -33.391202;
        _this4.config.lng = -70.542715;
        var box = yield map.getBoundingBox();
        console.log(box);
        var mesh = yield map.get2D_meshgrid(box);
        var elev = yield _this4.getElevation(mesh);
        console.log('elev', elev[0]);
        var time_end = process.hrtime(time_start);
        console.info('Execution time (hr): %ds %dms', time_end[0], time_end[1] / 1000000); //console.log('mesh',mesh);
      })();
    }

    setImmediatePromise() {
      //for preventing freezing node thread within loops (fors)
      return new Promise(resolve => {
        setImmediate(() => resolve());
      });
    }

  }

  return heightmap;

})));
