
try {
  const pixelate = require('./utils/pixelate.js');
  console.log('pixelate.js loaded successfully');
  const colorData = require('./data/color-data.js');
  console.log('color-data.js loaded successfully');
  const colorMapping = require('./data/color-mapping.js');
  console.log('color-mapping.js loaded successfully');
} catch (e) {
  console.error('Syntax Error:', e);
}
