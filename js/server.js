var t = require('./tunnel');
var socks = require('socksv5');
var port = 9000;
var transport = t.Transport.TCP;
if (process.argv.length >= 3) {
    port = parseInt(process.argv[2]);
    if (process.argv.length >= 4 && process.argv[3] == 'HTTP')
        transport = t.Transport.HTTP;
}
// start server
t.createServer({
    proxyHost: '127.0.0.1',
    proxyPort: 1080,
    transport: transport,
    checkAccessKey: function (key, cb) {
        cb(key == 'helloworld', 'anythingwhichisusedtoencryptthepackets');
    }
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