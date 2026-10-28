// The production webpack config, writing to build-win/pack with the Windows native modules swapped in.
// Never writes to pack/, so it can run beside a Linux build.
const path = require('path');
const webpack = require('webpack');
const configs = require('../../webpack.prod.js');

const root = path.resolve(__dirname, '../..');

module.exports = configs.map((config) => ({
  ...config,
  output: { ...config.output, path: path.join(root, 'build-win/pack') },
  plugins: [
    ...config.plugins,
    new webpack.NormalModuleReplacementPlugin(/build[\\/]Release[\\/](volume|black-magic)\.node$/, (resource) => {
      const name = path.basename(resource.request);
      resource.request = path.join(root, 'build-win/native', name);
    }),
  ],
}));
