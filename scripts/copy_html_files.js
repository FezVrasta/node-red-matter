const glob = require('glob');
const ncp = require('ncp').ncp;

// Source and destination paths
const sourceDir = 'src/**/*.html';
const destinationDir = 'lib/src';

// Copy HTML files
glob.sync(sourceDir).forEach((file) => {
  const destinationFile = file.replace(/^src\//, `${destinationDir}/`);
  ncp(file, destinationFile, (err) => {
    if (err) {
      console.error(`Error copying ${file}:`, err);
      return;
    }
    console.log(`Copied ${file} to ${destinationFile}`);
  });
});
