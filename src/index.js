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
        
    }

    async runTest() {
        this.config.lat = -33.391202;
        this.config.lng = -70.542715;
        let box = await map.getBoundingBox();
        console.log(box);
        let mesh = await map.get2D_meshgrid(box);
        //console.log('mesh',mesh);
    }

    setImmediatePromise() {
        //for preventing freezing node thread within loops (fors)
        return new Promise((resolve) => {
          setImmediate(() => resolve());
        });
    }
}