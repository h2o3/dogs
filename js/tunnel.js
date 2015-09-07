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
                resp.writeHead(200, { 'content-type': 'application/stream' });
                _this.handleClient(req, resp);
            });
        }
    };
    TunnelServer.prototype.listen = function (port, host) {
        this.server.listen.call(this.server, port, host);
    };
    TunnelServer.prototype.handShake = function (upstream, downstream, callback) {
        var _this = this;
        var len;
        var key;
        var consumer = new reader.Reader();
        var consumeSpec = [
            {
                state: 0,
                target: 1,
                count: function () { return 1; },
                action: function (buffer) {
                    len = buffer.readUInt8(0);
                }
            },
            {
                state: 1,
                target: 2,
                count: function () { return len; },
                action: function (buffer) {
                    key = buffer.slice(0, len).toString();
                }
            },
            {
                state: 2,
                target: 3,
                count: function () { return 0; },
                action: function (buffer) {
                    upstream.removeListener('readable', dataHandler);
                    upstream.unshift(consumer.remain());
                    _this.options.checkAccessKey(key, function (pass, password) {
                        console.log('auth result: ', pass, ' with key:', key);
                        if (pass) {
                            callback(consumer.remain(), password);
                        }
                        else {
                            downstream.end();
                        }
                    });
                }
            }
        ];
        var dataHandler = function () {
            var data = upstream.read();
            consumer.feed(data);
            consumer.consumeAll(consumeSpec);
        };
        upstream.on('readable', dataHandler);
    };
    TunnelServer.prototype.handleClient = function (upstream, downstream) {
        var _this = this;
        upstream.on('error', function (e) { return console.log('upstream error:', e); });
        downstream.on('error', function (e) { return console.log('downstream error:', e); });
        this.handShake(upstream, downstream, function (remain, password) {
            var cipher = new secure.EncryptStream(password);
            var decipher = new secure.DecryptStream(password);
            var proxy = net.connect(_this.options.proxyPort, _this.options.proxyHost, function () {
                proxy.pipe(cipher).pipe(downstream);
                decipher.pipe(proxy);
                upstream.on('readable', function () {
                    var chunk;
                    while ((chunk = upstream.read()) != null) {
                        console.log('read:', chunk);
                        decipher.write(chunk);
                    }
                });
                upstream.read(0);
            });
            upstream.on('close', function () { return proxy.end(); });
            proxy.on('close', function () { return downstream.end(); });
            proxy.on('error', function (e) { return console.log('proxy error: ', e); });
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
                method: 'POST'
            }, function (resp) {
                resp.on('error', function (e) { return console.log('downstream error:', e); });
                resp.pipe(decipher).pipe(socket);
            });
            this.handShake(request, function () {
                socket.pipe(cipher).pipe(request);
            });
            return request;
        }
    };
    TunnelClient.prototype.handleClient = function (socket) {
        var address = socket.remoteAddress + ":" + socket.remotePort;
        var upstream = this.bindTransport(socket);
        upstream.on('close', function () { return socket.end(); });
        socket.on('close', function () { return upstream.end(); });
        upstream.on('error', function (e) { return console.log('upstream for [' + address + '] error:', e); });
        socket.on('error', function (e) { return console.log('socket @ [' + address + '] error:', e); });
    };
    return TunnelClient;
})();
exports.TunnelClient = TunnelClient;
//# sourceMappingURL=tunnel.js.map