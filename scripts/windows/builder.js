// Builds the NSIS installer from build-win/pack on Linux, without Wine.
const path = require('path');

// electron-builder only uses Wine to extract the uninstaller; on "Catalina" it takes a pure-JS path instead.
// Resolved from electron-builder so it patches the same copy electron-builder loads (pnpm doesn't hoist it).
const macosVersion = require.resolve('app-builder-lib/out/util/macosVersion', {
  paths: [path.dirname(require.resolve('electron-builder'))],
});
require(macosVersion).isMacOsCatalina = () => true;
const builder = require('electron-builder');

const root = path.resolve(__dirname, '../..');
const pkg = require(path.join(root, 'package.json'));

builder
  .build({
    projectDir: root,
    targets: builder.Platform.WINDOWS.createTarget('nsis', builder.Arch.x64),
    publish: 'never',
    config: {
      ...pkg.build,
      files: [{ from: 'build-win/pack', to: 'pack', filter: ['**/*'] }, 'package.json', './icon.*'],
      directories: { output: 'dist-win' },
      npmRebuild: false,
      asarUnpack: ['**/*.node'],
      win: { icon: 'icon.ico' },
      nsis: { artifactName: '${name}-${version}-setup.${ext}' },
      publish: null,
    },
  })
  .then((files) => console.log(files.join('\n')))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
