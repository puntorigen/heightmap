/**
 * Heightmap: A class for freely creating a heightmap from a given latitude/longitude point, precision sample and horizon distance.
 * @name 	heightmap
 * @module 	heightmap
 **/

export default class heightmap {

    constructor(config = {}) {
        let defaults = {
            lat: -1,
            lng: -1,
            precision: 200,
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
        return Math.ceil(distance/this.config.precision); //meters for each step
    }

    async get2D_meshgrid(box) {
        //step 3
        const geolib = require('geolib');
        let steps = await this.getStepValue(box);
        let array2D = [];
        let range = Array(steps).fill(0);
        for (let y in range) {
            let row = [];
            let row_position = geolib.computeDestinationPoint(box.topLeft,this.config.precision*y,180);
            for (let x in range) {
                let tmp = geolib.computeDestinationPoint(row_position,this.config.precision*x,90);
                row.push(tmp);
            }
            array2D.push(row);
        }
        console.log('debug:',{ steps, rows:array2D.length, cols:array2D[0].length });
        return array2D;
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
        let elev = await this.getElevation(mesh);
        console.log('elev',elev[0]);
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