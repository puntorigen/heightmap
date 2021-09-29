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
   * Heightmap: A class for freely creating a heightmap from a given latitude/longitude point, pixel_size sample and horizon distance.
   * @name 	heightmap
   * @module 	heightmap
   **/
  class heightmap {
    constructor() {
      var config = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
      var defaults = {
        lat: -1,
        lng: -1,
        pixel_size: 200,
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

        return Math.ceil(distance / _this2.config.pixel_size); //meters for each step
      })();
    }

    getMeshgrid(box) {
      var _arguments = arguments,
          _this3 = this;

      return _asyncToGenerator(function* () {
        var tiles = _arguments.length > 1 && _arguments[1] !== undefined ? _arguments[1] : false;

        //step 3
        //also added 'tiles' option, in case you wish to grab a map layer (ex streetmap, cloud map, etc)
        var coord = require('coordinates2tile');

        var geolib = require('geolib');

        var steps = yield _this3.getStepValue(box);
        var resp = {
          array2D: [],
          tiles: []
        };
        var tiles_pos = {
          x: 0,
          y: 0
        };
        var tiles_keys = {};
        var range = Array(steps).fill(0);

        for (var y in range) {
          var row = [],
              row_tile = [];
          var row_position = geolib.computeDestinationPoint(box.topLeft, _this3.config.pixel_size * y, 180);

          for (var x in range) {
            var tmp = geolib.computeDestinationPoint(row_position, _this3.config.pixel_size * x, 90);

            if (tiles) {
              var tile_tmp = {
                z: 12,
                //zoom 1-18 (amount of detail, more better the quality)
                x: coord.lat2tile(tmp.latitude, 12),
                y: coord.long2tile(tmp.longitude, 12),
                pos_x: tiles_pos.x,
                pos_y: tiles_pos.y
              };

              if (tiles_keys["".concat(tile_tmp.x, "-").concat(tile_tmp.y)] === undefined) {
                // only append different tiles
                tiles_keys["".concat(tile_tmp.x, "-").concat(tile_tmp.y)] = 1;
                row_tile.push(tile_tmp);
                tiles_pos.x += 1;
              }
            }

            row.push(tmp);
          }

          resp.array2D.push(row);

          if (tiles) {
            if (row_tile.length > 0) {
              resp.tiles.push(row_tile);
              tiles_pos.y += 1;
            }
          }
        }

        console.log('debug:', {
          steps,
          rows: resp.array2D.length,
          cols: resp.array2D[0].length
        });
        if (!tiles) delete resp.tiles;
        return resp.array2D;
      })();
    }

    getTiles(meshgrid) {
      return _asyncToGenerator(function* () {
        //step 4, option 2
        var coord = require('coordinates2tile');

        var resp = [];
        var tiles_pos = {
          x: 0,
          y: 0
        };
        var tiles_keys = {};
        var range = Array(meshgrid.length).fill(0);

        for (var y in range) {
          var row_tile = [];

          for (var x in range) {
            var tile_tmp = {
              z: 15,
              //zoom 1-18 (amount of detail, more, better the quality)
              x: coord.lat2tile(meshgrid[y][x].latitude, 15),
              y: coord.long2tile(meshgrid[y][x].longitude, 15),
              pos_x: tiles_pos.x,
              pos_y: tiles_pos.y
            };

            if (tiles_keys["".concat(tile_tmp.x, "-").concat(tile_tmp.y)] === undefined) {
              // only append different tiles
              tiles_keys["".concat(tile_tmp.x, "-").concat(tile_tmp.y)] = 1;
              row_tile.push(tile_tmp);
              tiles_pos.x += 1;
            }
          }

          if (row_tile.length > 0) {
            resp.push(row_tile);
            tiles_pos.y += 1;
          }
        }

        return resp;
      })();
    }
    /*
    async renderTiles(tiles,url='https://s3.amazonaws.com/elevation-tiles-prod/normal/{z}/{x}/{y}.png') {
        //step 4, option 2, step 2
        //given a tile server url, render the given tiles object, return an image
        const axios = require('axios');
        const mergeImages = require('merge-images');
        const { Canvas, Image } = require('canvas');
        let fs = require('fs').promises;
        let getTileBuffer = async function(uri) {
            let resp = (await axios({ url:uri, responseType: "arraybuffer" })).data;
            return resp;
        };
        let renderObj = [];
        for (let y in tiles) {
            let parallel_x_buf = [];
            for (let x in tiles[y]) {
                let tmp_url    =    url .replace('{z}',tiles[y][x].z)
                                        .replace('{x}',tiles[y][x].x)
                                        .replace('{y}',tiles[y][x].y);
                parallel_x_buf.push(axios({ url:tmp_url, responseType: "arraybuffer" }));
            }
            //request tiles from current row, as buffers
            let callthem = await Promise.all(parallel_x_buf);
            for (let x in callthem) {
                renderObj.push({
                    src: callthem[x].data,
                    x: tiles[y][x].pos_x*256,
                    y: tiles[y][x].pos_y*256
                });
            }
            //break; //just process first row first
        }
        console.log('tiles ready');
        let map64 = await mergeImages(renderObj, { Canvas,Image });
        await fs.writeFile('test.png',Buffer(map64,'base64'));
        console.log('base64 map',map64);
        return renderObj;
    }*/


    getElevation(meshgrid) {
      return _asyncToGenerator(function* () {
        //step 4
        //transform grid2d array into single array (flat)
        var axios = require('axios'); //requesting each row elevation ...


        var service = 'https://api.open-elevation.com/api/v1/lookup';
        var config = {
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        };
        var parallel = [];

        for (var row in meshgrid) {
          var data = {
            "locations": meshgrid[row]
          };
          var elevation = axios.post(service, data, config);
          parallel.push(elevation);
        }

        var callthem = yield Promise.all(parallel); // assign results

        for (var _row in callthem) {
          meshgrid[_row] = callthem[_row].data.results;
        } //console.log('total_records',total_records.length);


        return meshgrid;
      })();
    }

    getMeshgridWithinPolygon(polygonArray) {
      var distance = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 30;
      //distance is in meters, polygonArray format (or GeoJSON):

      /*
      [{ latitude: 52.516272, longitude: 13.377722 },{ latitude: 51.515, longitude: 7.453619 },{ latitude: 51.503333, longitude: -0.119722 }]
      */
      var polygonAsGeoJson = {};

      if (polygonArray.type) {
        polygonAsGeoJson = polygonArray; // added support for polygonArray as GeoJSON
      } else {
        var transformedPolygon = [];

        for (var point of polygonArray) {
          transformedPolygon.push([point.longitude, point.latitude]);
        } //repeat first item as last, to close polygon


        if (transformedPolygon[0] != transformedPolygon[transformedPolygon.length - 1]) {
          transformedPolygon.push([polygonArray[0].longitude, polygonArray[0].latitude]);
        }

        polygonAsGeoJson = {
          "type": "FeatureCollection",
          "features": [{
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'Polygon',
              coordinates: [transformedPolygon]
            }
          }]
        };
      }

      var turf = require('@turf/turf');

      var caja = turf.bbox(polygonAsGeoJson);
      var area = turf.area(polygonAsGeoJson.features[0].geometry);
      var grid = turf.pointGrid(caja, distance / 1000, {
        mask: polygonAsGeoJson.features[0].geometry
      }); //console.log('area de poligono (en hectareas)',{ hectareas:area/10000, metros:area });
      //console.log('cantidad de equipos',grid.features.length);
      // return grid

      return {
        grid,
        area,
        amount: grid.features.length
      };
    }

    testPolyGrid() {
      var poly = [{
        latitude: 52.516272,
        longitude: 13.377722
      }, {
        latitude: 51.515,
        longitude: 7.453619
      }, {
        latitude: 51.503333,
        longitude: -0.119722
      }];
      var test = this.getMeshgridWithinPolygon(poly, 1000);
      return test;
    }

    runTest() {
      var _this4 = this;

      return _asyncToGenerator(function* () {
        var time_start = process.hrtime();
        _this4.config.lat = -33.391202;
        _this4.config.lng = -70.542715;
        var box = yield _this4.getBoundingBox();
        console.log(box);
        var mesh = yield _this4.getMeshgrid(box); //option 1
        //let elev = await this.getElevation(mesh);
        //console.log('elev',elev[0]);
        //option 2

        yield _this4.getTiles(mesh); //let tiles_test = await this.renderTiles(tiles);
        //console.log('row tiles with url',tiles_test);
        //end

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
