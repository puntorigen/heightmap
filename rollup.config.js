import babel            from '@rollup/plugin-babel';
import { nodeResolve }  from '@rollup/plugin-node-resolve';
import copy             from 'rollup-plugin-copy-assets';
//import compiler         from '@ampproject/rollup-plugin-closure-compiler';

const config = {
  input: 'src/index.js',
  external: [],
  output: {
    file: 'lib/index.js',
    format: 'umd',
    name: 'heightmap',
    sourcemap: false
  },

  plugins: [
    nodeResolve(),
    babel({
      presets: [
        ['@babel/preset-env',
        {
          targets: {
            esmodules: true,
          },
        }]
      ],
      exclude: '**/node_modules/**',
      babelHelpers: 'bundled',
    }),
    copy({
      assets: []
    }),
    //compiler()
  ]
};

export default config;