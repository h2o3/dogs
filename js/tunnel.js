var net = require('net');
var tls = require('tls');
var fs = require('fs');
var TunnelServer = (function () {
    function TunnelServer(host, port) {
        var options = {
            key: fs.readFileSync('keys/server-key.pem'),
            cert: fs.readFileSync('keys/server-cert.pem'),
            ca: [fs.readFileSync('keys/client-cert.pem')]
        };
        var server = tls.createServer(options, this.handleClient.bind(this));
        server.listen(9000);
        this.proxyHost = host;
        this.proxyPort = port;
    }
    TunnelServer.prototype.handleClient = function (client) {
        var proxy = net.connect(this.proxyPort, this.proxyHost, function () {
            client.pipe(proxy);
            proxy.pipe(client);
        });
        client.on('close', function () {
            console.log('client connection closed');
            proxy.end();
        });
        proxy.on('close', function () {
            console.log('proxy connection closed');
            client.end();
        });
        proxy.on('error', function (e) { return console.log('proxy error: ', e); });
        client.on('error', function (e) { return console.log('proxy error: ', e); });
    };
    return TunnelServer;
})();
exports.TunnelServer = TunnelServer;
var TunnelClient = (function () {
    function TunnelClient(host, port) {
        var server = net.createServer(this.handleClient.bind(this));
        server.listen(9001);
        this.tunnelHost = host;
        this.tunnelPort = port;
    }
    TunnelClient.prototype.handleClient = function (socket) {
        var address = socket.remoteAddress + ":" + socket.remotePort;
        var tunnel = tls.connect(this.tunnelPort, this.tunnelHost, {
            key: fs.readFileSync('keys/client-key.pem'),
            cert: fs.readFileSync('keys/client-cert.pem'),
            ca: [fs.readFileSync('keys/server-cert.pem')],
            checkServerIdentity: function (host, cert) {
                return undefined;
            }
        }, function () {
            socket.pipe(tunnel);
            tunnel.pipe(socket);
        });
        tunnel.on('close', function () {
            console.log('tunnel for [' + address + '] disconnected');
            socket.end();
        });
        socket.on('close', function () {
            console.log('connection [' + address + '] disconnected');
            tunnel.end();
        });
        tunnel.on('error', function (e) { return console.log('tunnel for [' + address + '] error: ', e); });
        socket.on('error', function (e) { return console.log('tunnel for [' + address + '] error: ', e); });
    };
    return TunnelClient;
})();
exports.TunnelClient = TunnelClient;
//# sourceMappingURL=tunnel.js.map