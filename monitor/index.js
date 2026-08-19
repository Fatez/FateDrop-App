const { run } = require("./collector");
run().catch(error => { console.error(`FATEDROP FAILED: ${error.message}`); process.exitCode = 1; });
