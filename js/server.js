var t = require('./tunnel');
var socks = require('socksv5');
// start server
new t.TunnelServer('127.0.0.1', 1080);
// start proxy server
var server = socks.createServer(function (info, accept, deny) {
    console.log("proxy", info);
    accept();
});
server.listen(1080, '127.0.0.1');
server.useAuth(socks.auth.None());
//# sourceMappingURL=server.js.map