var net = require('net');
var http = require('http');
var secure = require('./secure');
var reader = require('./reader');
(function (Transport) {
    Transport[Transport["TCP"] = 0] = "TCP";
    Transport[Transport["HTTP"] = 1] = "HTTP";
})(exports.Transport || (exports.Transport = {}));
var Transport = exports.Transport;
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
        this.options = options;
        this.initTransport();
    }
    TunnelServer.prototype.initTransport = function () {
        var _this = this;
        if (this.options.transport == Transport.TCP) {
            this.server = net.createServer(function (socket) {
                _this.handleClient(socket, socket);
            });
        }
        else {
            this.server = http.createServer(function (req, resp) {
                resp.writeHead(200, { 'content-type': 'text/plain' });
                resp.end('ok');
            });
            this.server.on('upgrade', function (req, socket, head) {
                if (req.headers.upgrade == 'DOGS') {
                    socket.write('HTTP/1.1 101 Switching protocol\r\n' +
                        'Upgrade: DOGS\r\n' +
                        'Connection: Upgrade\r\n' +
                        '\r\n');
                    _this.handleClient(socket, socket);
                }
                else {
                    socket.end();
                }
            });
        }
    };
    TunnelServer.prototype.listen = function (port, host) {
        this.server.listen.call(this.server, port, host);
    };
    TunnelServer.prototype.handleClient = function (upstream, downstream) {
        var _this = this;
        var len;
        var key;
        var cipher;
        var decipher;
        var proxy;
        var consumer = new reader.Reader([
            {
                state: 0,
                count: function () { return 1; },
                action: function (cb, buffer) {
                    len = buffer.readUInt8(0);
                    cb(1);
                }
            },
            {
                state: 1,
                count: function () { return len; },
                action: function (cb, buffer) {
                    key = buffer.slice(0, len).toString();
                    cb(2);
                }
            },
            {
                state: 2,
                count: function () { return 0; },
                action: function (cb, buffer) {
                    _this.options.checkAccessKey(key, function (pass, password) {
                        console.log('auth result:', pass, ' with key:', key);
                        if (pass) {
                            cipher = new secure.EncryptStream(password);
                            decipher = new secure.DecryptStream(password);
                            proxy = net.connect(_this.options.proxyPort, _this.options.proxyHost, function () {
                                proxy.pipe(cipher).pipe(downstream);
                                decipher.pipe(proxy);
                            });
                            proxy.on('error', function (e) { return console.log('proxy error:', e); });
                            var cleanup = function () {
                                if (proxy.writable)
                                    proxy.end();
                                if (downstream.writable)
                                    downstream.end();
                            };
                            proxy.on('end', cleanup).on('close', cleanup);
                            upstream.on('end', cleanup).on('close', cleanup);
                            cb(3);
                        }
                        else {
                            cb(4);
                        }
                    });
                }
            },
            {
                state: 3,
                count: function () { return Number.MAX_VALUE; },
                action: function (cb, buffer) {
                    // forward data to proxy
                    decipher.write(buffer);
                    cb(3);
                }
            },
            {
                state: 4,
                count: function () { return 0; },
                action: function (cb, buffer) {
                    downstream.end();
                }
            }
        ]);
        var dataHandler = function () {
            var data = upstream.read();
            if (data) {
                consumer.feed(data);
                consumer.consumeAll();
            }
        };
        upstream.on('readable', dataHandler);
        upstream.on('error', function (e) { return console.log('upstream error:', e); });
        downstream.on('error', function (e) { return console.log('downstream error:', e); });
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
    TunnelClient.prototype.handShake = function (upstream, callback) {
        var keyBuffer = new Buffer(this.options.accessKey);
        var lenBuffer = new Buffer(1);
        lenBuffer.writeUInt8(keyBuffer.length, 0);
        upstream.write(Buffer.concat([lenBuffer, keyBuffer]));
        callback();
    };
    TunnelClient.prototype.bindTransport = function (socket) {
        var _this = this;
        if (this.options.transport == Transport.TCP) {
            var tunnel = net.connect(this.options.serverPort, this.options.serverHost, function () {
                _this.handShake(tunnel, function () {
                    var cipher = new secure.EncryptStream(_this.options.password);
                    var decipher = new secure.DecryptStream(_this.options.password);
                    socket.pipe(cipher).pipe(tunnel);
                    tunnel.pipe(decipher).pipe(socket);
                });
            });
            return tunnel;
        }
        else {
            var cipher = new secure.EncryptStream(this.options.password);
            var decipher = new secure.DecryptStream(this.options.password);
            var request = http.request({
                host: this.options.serverHost,
                port: this.options.serverPort,
                method: 'GET',
                headers: {
                    'Upgrade': 'DOGS',
                    'Connection': 'Upgrade'
                }
            });
            request.on('upgrade', function (resp, tunnel, head) {
                tunnel.on('error', function (e) { return console.log('downstream error:', e); });
                if (resp.headers.upgrade != 'DOGS')
                    tunnel.end();
                _this.handShake(tunnel, function () {
                    socket.pipe(cipher).pipe(tunnel);
                });
                tunnel.pipe(decipher).pipe(socket);
            });
            request.flushHeaders();
            return request;
        }
    };
    TunnelClient.prototype.handleClient = function (socket) {
        var address = socket.remoteAddress + ":" + socket.remotePort;
        var upstream = this.bindTransport(socket);
        var cleanup = function () {
            if (upstream.writable)
                upstream.end();
            if (socket.writable)
                socket.end();
        };
        socket.on('close', cleanup);
        upstream.on('error', function (e) { return console.log('upstream for [' + address + '] error:', e); });
        socket.on('error', function (e) { return console.log('socket @ [' + address + '] error:', e); });
    };
    return TunnelClient;
})();
exports.TunnelClient = TunnelClient;
//# sourceMappingURL=tunnel.js.map