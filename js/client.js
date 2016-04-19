"use strict";
var t = require('./tunnel');
var serverHost = '127.0.0.1';
var serverPort = 443;
if (process.argv.length >= 3) {
    serverHost = process.argv[2];
    if (process.argv.length >= 4)
        serverPort = parseInt(process.argv[3]);
}
// start client
t.connect({
    serverHost: serverHost,
    serverPort: serverPort
}).listen(9001);
//# sourceMappingURL=client.js.map