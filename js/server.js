"use strict";
var t = require('./tunnel');
var socks = require('socksv5');
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
var server = socks.createServer(function (info, accept, deny) {
    console.log("proxy", info.dstAddr);
    accept();
});
server.listen(1080, '127.0.0.1', function () {
    console.log('socksv5 listening on 1080');
});
server.useAuth(socks.auth.None());
//# sourceMappingURL=server.js.map