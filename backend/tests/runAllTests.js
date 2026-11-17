console.log('====================================================');
console.log('🚀 YenSync Test Suite Runner');
console.log('====================================================\n');

require('./clashDetector.test.js');
require('./scheduler.test.js');

const { runAllotmentTests } = require('./allotment.test.js');
runAllotmentTests().then(() => {
  console.log('✨ All YenSync Core Engine Tests Executed Successfully!');
}).catch(err => {
  console.error(err);
  process.exit(1);
});
