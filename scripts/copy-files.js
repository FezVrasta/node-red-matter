const glob = require('glob');
const ncp = require('ncp').ncp;
const path = require('path');
const fs = require('fs');

// Source and destination paths
const sourceDir = 'src/**/*.{html,svg}';
const destinationDir = 'lib/src';

// Copy HTML files
glob.sync(sourceDir).forEach((file) => {
  const destinationFile = file.replace(/^src\//, `${destinationDir}/`);

  // create directory recursively if it doesn't exist
  const destinationDirname = path.dirname(destinationFile);
  if (!fs.existsSync(destinationDirname)) {
    fs.mkdirSync(destinationDirname, { recursive: true });
  }

  ncp(file, destinationFile, (err) => {
    if (err) {
      console.error(`Error copying ${file}:`, err);
      return;
    }
    console.log(`Copied ${file} to ${destinationFile}`);
  });
});
