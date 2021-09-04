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

    async get2D_meshgrid(box,tiles=false) {
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
        return resp;
    }

    async getElevation(grid2d) {
        //step 4
        //transform grid2d array into single array (flat)
        const axios = require('axios');
        let bak = JSON.parse(JSON.stringify(grid2d)); //make a clone
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
        let service = 'https://api.open-elevation.com/api/v1/lookup';
        let config = {
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        };
        let parallel = [];
        for (let row in grid2d) {
            let data = { "locations":grid2d[row] };
            //console.log('requesting row:'+(row+1)+' of '+grid2d.length);
            let elevation = axios.post(service,data,config);
            parallel.push(elevation);
            //grid2d[row] = elevation.data.results;
            //break;
        }
        let callthem = await Promise.all(parallel);
        // assign results
        for (let row in callthem) {
            grid2d[row] = callthem[row].data.results;
        }
        //
        //console.log('total_records',total_records.length);
        return grid2d;
    }

    async runTest() {
        let time_start = process.hrtime();
        this.config.lat = -33.391202;
        this.config.lng = -70.542715;
        let box = await map.getBoundingBox();
        console.log(box);
        let mesh = await map.get2D_meshgrid(box);
        let elev = await this.getElevation(mesh.array2D);
        console.log('elev',elev[0]);
        if (mesh.tiles) console.log('row tiles',mesh.tiles);
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