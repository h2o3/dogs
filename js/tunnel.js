var net = require('net');
var secure = require('./secure');
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
        this.server = net.createServer(this.handleClient.bind(this));
        this.options = options;
    }
    TunnelServer.prototype.listen = function (port, host) {
        this.server.listen(port, host);
    };
    TunnelServer.prototype.handShake = function (socket, callback) {
        var _this = this;
        var state = 0;
        var chunk;
        var len;
        var key;
        var readableHandler = function () {
            // read length of key
            if (state == 0) {
                if ((chunk = socket.read(1)) != null) {
                    len = chunk.readUInt8(0);
                    state = 1;
                }
            }
            // read the key
            if (state == 1) {
                if ((chunk = socket.read(len)) != null) {
                    key = chunk.toString();
                    state = 2;
                }
            }
            // verify key and finish handshake
            if (state == 2) {
                socket.removeListener('readable', readableHandler);
                _this.options.checkAccessKey(key, function (pass, password) {
                    console.log('auth result: ', pass, ' with key:', key);
                    if (pass) {
                        callback(password);
                    }
                    else {
                        socket.end();
                    }
                });
            }
        };
        socket.on('readable', readableHandler);
    };
    TunnelServer.prototype.handleClient = function (client) {
        var _this = this;
        client.on('error', function (e) { return console.log('proxy error: ', e); });
        this.handShake(client, function (password) {
            var proxy = net.connect(_this.options.proxyPort, _this.options.proxyHost, function () {
                var cipher = new secure.EncryptStream(password);
                var decipher = new secure.DecryptStream(password);
                proxy.pipe(cipher).pipe(client);
                client.pipe(decipher).pipe(proxy);
            });
            proxy.on('error', function (e) { return console.log('proxy error: ', e); });
            client.on('close', function () {
                proxy.end();
            });
            proxy.on('close', function () {
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
        var tunnel = net.connect(this.options.serverPort, this.options.serverHost, function () {
            _this.handShake(tunnel, function () {
                var cipher = new secure.EncryptStream(_this.options.password);
                var decipher = new secure.DecryptStream(_this.options.password);
                socket.pipe(cipher).pipe(tunnel);
                tunnel.pipe(decipher).pipe(socket);
            });
        });
        tunnel.on('close', function () {
            socket.end();
        });
        socket.on('close', function () {
            tunnel.end();
        });
        tunnel.on('error', function (e) { return console.log('tunnel for [' + address + '] error: ', e); });
        socket.on('error', function (e) { return console.log('tunnel for [' + address + '] error: ', e); });
    };
    return TunnelClient;
})();
exports.TunnelClient = TunnelClient;
//# sourceMappingURL=tunnel.js.map