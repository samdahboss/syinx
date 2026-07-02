const fs = require('fs');
try {
  fs.rmSync('entrypoints/popup', { recursive: true, force: true });
  console.log('Deleted popup directory');
} catch (e) {
  // ignore
}
