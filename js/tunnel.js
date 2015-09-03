var net = require('net');
var tls = require('tls');
var fs = require('fs');
function createServer(options) {
    return new TunnelServer(options);
}
exports.createServer = createServer;
function connect(options) {
    return new TunnelClient(options);
}
exports.connect = connect;
var TunnelServer = (function () {
    function TunnelServer(options) {
        var tlsOptions = {
            key: fs.readFileSync('keys/server-key.pem'),
            cert: fs.readFileSync('keys/server-cert.pem'),
            ca: [fs.readFileSync('keys/client-cert.pem')]
        };
        this.tlsServer = tls.createServer(tlsOptions, this.handleClient.bind(this));
        this.options = options;
    }
    TunnelServer.prototype.listen = function (port, host) {
        this.tlsServer.listen(port, host);
    };
    TunnelServer.prototype.handShake = function (socket, callback) {
        var _this = this;
        var state = 0;
        var chunk;
        var len;
        var key;
        var readableHandler = function () {
            if (state == 0) {
                if ((chunk = socket.read(1)) != null) {
                    len = chunk.readUInt8(0);
                    state = 1;
                }
            }
            else if (state == 1) {
                if ((chunk = socket.read(len)) != null) {
                    key = chunk.toString();
                    socket.removeListener('readable', readableHandler);
                    _this.options.checkAccessKey(key, function (pass) {
                        console.log('auth result: ', pass, ' with key:', key);
                        if (pass) {
                            callback();
                        }
                        else {
                            socket.end();
                        }
                    });
                }
            }
        };
        socket.on('readable', readableHandler);
    };
    TunnelServer.prototype.handleClient = function (client) {
        var _this = this;
        client.on('error', function (e) { return console.log('proxy error: ', e); });
        this.handShake(client, function () {
            var proxy = net.connect(_this.options.proxyPort, _this.options.proxyHost, function () {
                client.pipe(proxy);
                proxy.pipe(client);
            });
            proxy.on('error', function (e) { return console.log('proxy error: ', e); });
            client.on('close', function () {
                console.log('client connection closed');
                proxy.end();
            });
            proxy.on('close', function () {
                console.log('proxy connection closed');
                client.end();
            });
        });
    };
    return TunnelServer;
})();
exports.TunnelServer = TunnelServer;
var TunnelClient = (function () {
    function TunnelClient(options) {
        this.listenServer = net.createServer(this.handleClient.bind(this));
        this.options = options;
    }
    TunnelClient.prototype.listen = function (port, host) {
        this.listenServer.listen(port, host);
    };
    TunnelClient.prototype.handShake = function (socket, callback) {
        var keyBuffer = new Buffer(this.options.accessKey);
        var lenBuffer = new Buffer(1);
        lenBuffer.writeUInt8(keyBuffer.length, 0);
        socket.write(Buffer.concat([lenBuffer, keyBuffer]));
        callback();
    };
    TunnelClient.prototype.handleClient = function (socket) {
        var _this = this;
        var address = socket.remoteAddress + ":" + socket.remotePort;
        var tunnel = tls.connect(this.options.serverPort, this.options.serverHost, {
            key: fs.readFileSync('keys/client-key.pem'),
            cert: fs.readFileSync('keys/client-cert.pem'),
            ca: [fs.readFileSync('keys/server-cert.pem')],
            checkServerIdentity: function (host, cert) {
                return undefined;
            }
        }, function () {
            _this.handShake(tunnel, function () {
                socket.pipe(tunnel);
                tunnel.pipe(socket);
            });
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