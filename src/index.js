/**
 * Heightmap: A class for freely creating a heightmap from a given latitude/longitude point, pixel_size sample and horizon distance.
 * @name 	heightmap
 * @module 	heightmap
 **/

export default class heightmap {

    constructor(config = {}) {
        let defaults = {
            lat: -1,
            lng: -1,
            pixel_size: 200,
            distance: 20
        };
        this.config = {...defaults, ...config };
        this.config.distance = this.config.distance*1000; //transform to meters 
    }

    async getBoundingBox() {
        //step 1
        const geolib = require('geolib');
        let box = {
            topLeft: -1,
            topRight: -1,
            bottomLeft: -1,
            bottomRight: -1,
            polygon: []
        };
        box.topRight = geolib.computeDestinationPoint({ latitude:this.config.lat, longitude:this.config.lng }, this.config.distance, 45);
        box.bottomRight = geolib.computeDestinationPoint({ latitude:this.config.lat, longitude:this.config.lng }, this.config.distance, 45*3);
        box.bottomLeft = geolib.computeDestinationPoint({ latitude:this.config.lat, longitude:this.config.lng }, this.config.distance, 45*5);
        box.topLeft = geolib.computeDestinationPoint({ latitude:this.config.lat, longitude:this.config.lng }, this.config.distance, 45*7);
        box.polygon.push(box.topLeft);
        box.polygon.push(box.topRight);
        box.polygon.push(box.bottomRight);
        box.polygon.push(box.bottomLeft);
        return box;
    }

    async getStepValue(box) {
        //step 2
        const geolib = require('geolib');
        let distance = geolib.getDistance(box.topLeft,box.topRight); //in mts
        return Math.ceil(distance/this.config.pixel_size); //meters for each step
    }

    async getMeshgrid(box,tiles=false) {
        //step 3
        //also added 'tiles' option, in case you wish to grab a map layer (ex streetmap, cloud map, etc)
        const coord = require('coordinates2tile');
        const geolib = require('geolib');
        let steps = await this.getStepValue(box);
        let resp = { array2D:[], tiles:[] };
        let tiles_pos = { x:0, y:0 };
        let tiles_keys = {};
        let range = Array(steps).fill(0);
        for (let y in range) {
            let row = [], row_tile = [];
            let row_position = geolib.computeDestinationPoint(box.topLeft,this.config.pixel_size*y,180);
            for (let x in range) {
                let tmp = geolib.computeDestinationPoint(row_position,this.config.pixel_size*x,90);
                if (tiles) {
                    let tile_tmp = {
                        z:12,  //zoom 1-18 (amount of detail, more better the quality)
                        x:coord.lat2tile(tmp.latitude,12),
                        y:coord.long2tile(tmp.longitude,12),
                        pos_x:tiles_pos.x,
                        pos_y:tiles_pos.y
                    };
                    if (tiles_keys[`${tile_tmp.x}-${tile_tmp.y}`] === undefined) {
                        // only append different tiles
                        tiles_keys[`${tile_tmp.x}-${tile_tmp.y}`] = 1;
                        row_tile.push(tile_tmp);
                        tiles_pos.x += 1;
                    }
                }
                row.push(tmp);
            }
            resp.array2D.push(row);
            if (tiles) {
                if (row_tile.length>0) {
                    resp.tiles.push(row_tile);
                    tiles_pos.y += 1;
                }
            }
        }
        console.log('debug:',{ steps, rows:resp.array2D.length, cols:resp.array2D[0].length });
        if (!tiles) delete resp.tiles;        
        return resp.array2D;
    }

    async getTiles(meshgrid) {
        //step 4, option 2
        const coord = require('coordinates2tile');
        let resp = [];
        let tiles_pos = { x:0, y:0 };
        let tiles_keys = {};
        let range = Array(meshgrid.length).fill(0);
        for (let y in range) {
            let row_tile = [];
            for (let x in range) {
                let tile_tmp = {
                    z:15,  //zoom 1-18 (amount of detail, more, better the quality)
                    x:coord.lat2tile(meshgrid[y][x].latitude,15),
                    y:coord.long2tile(meshgrid[y][x].longitude,15),
                    pos_x:tiles_pos.x,
                    pos_y:tiles_pos.y
                };
                if (tiles_keys[`${tile_tmp.x}-${tile_tmp.y}`] === undefined) {
                    // only append different tiles
                    tiles_keys[`${tile_tmp.x}-${tile_tmp.y}`] = 1;
                    row_tile.push(tile_tmp);
                    tiles_pos.x += 1;
                }
            }
            if (row_tile.length>0) {
                resp.push(row_tile);
                tiles_pos.y += 1;
            }
        }
        return resp;
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

    async getElevation(meshgrid) {
        //step 4
        //transform grid2d array into single array (flat)
        const axios = require('axios');
        //requesting each row elevation ...
        let service = 'https://api.open-elevation.com/api/v1/lookup';
        let config = {
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        };
        let parallel = [];
        for (let row in meshgrid) {
            let data = { "locations":meshgrid[row] };
            let elevation = axios.post(service,data,config);
            parallel.push(elevation);
        }
        let callthem = await Promise.all(parallel);
        // assign results
        for (let row in callthem) {
            meshgrid[row] = callthem[row].data.results;
        }
        //console.log('total_records',total_records.length);
        return meshgrid;
    }

    getMeshgridWithinPolygon(polygonArray,distance=30) {
        //distance is in meters, polygonArray format (or GeoJSON):
        /*
        [{ latitude: 52.516272, longitude: 13.377722 },{ latitude: 51.515, longitude: 7.453619 },{ latitude: 51.503333, longitude: -0.119722 }]
        */
        let polygonAsGeoJson = {};
        if (polygonArray.type) {
            polygonAsGeoJson = polygonArray; // added support for polygonArray as GeoJSON
        } else {
            let transformedPolygon = [];
            for (let point of polygonArray) {
                transformedPolygon.push([ point.longitude,point.latitude ]);
            }
            //repeat first item as last, to close polygon
            if (transformedPolygon[0]!=transformedPolygon[transformedPolygon.length-1]) {
                transformedPolygon.push([ polygonArray[0].longitude,polygonArray[0].latitude ]);
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
        let turf = require('@turf/turf');
        let caja = turf.bbox(polygonAsGeoJson);
        let area = turf.area(polygonAsGeoJson.features[0].geometry);
        let grid = turf.pointGrid(caja, (distance>999)?1000/distance:1/distance, { mask:polygonAsGeoJson.features[0].geometry });
        //console.log('area de poligono (en hectareas)',{ hectareas:area/10000, metros:area });
        //console.log('cantidad de equipos',grid.features.length);
        // return grid
        return { grid, area };
    }

    testPolyGrid() {
        let poly = [{ latitude: 52.516272, longitude: 13.377722 },{ latitude: 51.515, longitude: 7.453619 },{ latitude: 51.503333, longitude: -0.119722 }];
        let test = this.getMeshgridWithinPolygon(poly,1000);
        return test;
    }

    async runTest() {
        let time_start = process.hrtime();
        this.config.lat = -33.391202;
        this.config.lng = -70.542715;
        let box = await this.getBoundingBox();
        console.log(box);
        let mesh = await this.getMeshgrid(box);
        //option 1
        //let elev = await this.getElevation(mesh);
        //console.log('elev',elev[0]);
        //option 2
        let tiles = await this.getTiles(mesh);
        //let tiles_test = await this.renderTiles(tiles);
        //console.log('row tiles with url',tiles_test);
        //end
        let time_end = process.hrtime(time_start);
        console.info('Execution time (hr): %ds %dms', time_end[0], time_end[1] / 1000000);
        //console.log('mesh',mesh);
    }

    setImmediatePromise() {
        //for preventing freezing node thread within loops (fors)
        return new Promise((resolve) => {
          setImmediate(() => resolve());
        });
    }
}