const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
  entry: './scripts/content.js', 
  output: {
    filename: './scripts/content.js', 
    path: path.resolve(__dirname, 'dist'), 
    clean: true,
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        { from: 'manifest.json', to: 'manifest.json' },
        { from: 'scripts/sandbox.html', to: 'scripts/sandbox.html' },
        { from: 'scripts/sandbox.js', to: 'scripts/sandbox.js' },
        { from: 'lib/mediainfo.min.js', to: 'lib/mediainfo.min.js' },        
        { from: 'lib/MediaInfoModule.wasm', to: 'lib/MediaInfoModule.wasm' },
        { from: 'options.html', to: 'options.html' }, 
        { from: 'options.js', to: 'options.js' },       
        { from: 'icons', to: 'icons' }, 
      ],
    }),
  ],
  resolve: {
    fallback: {
      "url": false
    }
  },

  mode: 'production', 
  devtool: 'cheap-module-source-map',
};