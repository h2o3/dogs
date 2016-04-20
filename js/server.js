"use strict";
var t = require('./tunnel');
var http = require('http');
var setup = require('proxy');
var port = 9000;
if (process.argv.length >= 3) {
    port = parseInt(process.argv[2]);
}
// start server
t.createServer({
    proxyHost: '127.0.0.1',
    proxyPort: 1080
}).listen(port);
// start proxy server
var server = setup(http.createServer());
server.listen(1080, '127.0.0.1', function () {
    console.log('proxy listening on 1080');
});
//# sourceMappingURL=server.js.map