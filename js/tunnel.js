"use strict";
var net = require('net');
var http = require('http');
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
                _this.handleClient(socket, head);
            }
            else {
                socket.end();
            }
        });
    };
    TunnelServer.prototype.listen = function (port, host) {
        this.server.listen.call(this.server, port, host);
    };
    TunnelServer.prototype.handleClient = function (socket, head) {
        socket.on('error', function (e) { return console.log('socket error:', e); });
        var proxy = net.connect(this.options.proxyPort, this.options.proxyHost, function () {
            proxy.write(head);
            proxy.pipe(socket);
            socket.pipe(proxy);
        });
        proxy.on('error', function (e) { return console.log('proxy error:', e); });
        var cleanup = function () {
            if (proxy.writable)
                proxy.end();
            if (socket.writable)
                socket.end();
        };
        proxy.on('end', cleanup).on('close', cleanup);
        socket.on('end', cleanup).on('close', cleanup);
    };
    return TunnelServer;
}());
exports.TunnelServer = TunnelServer;
var TunnelClient = (function () {
    function TunnelClient(options) {
        this.listenServer = net.createServer(this.handleClient.bind(this));
        this.options = options;
    }
    TunnelClient.prototype.listen = function (port, host) {
        this.listenServer.listen(port, host);
    };
    TunnelClient.prototype.handleClient = function (socket) {
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
            tunnel.on('error', function (e) { return console.log('tunnel error:', e); });
            if (resp.headers.upgrade != 'DOGS')
                tunnel.end();
            socket.pipe(tunnel);
            tunnel.pipe(socket);
        });
        request.flushHeaders();
        var cleanup = function () {
            if (request.writable)
                request.end();
            if (this == socket) {
                if (socket.writable)
                    socket.end();
            }
            else {
                setTimeout(function () { if (socket.writable)
                    socket.end(); }, 1000);
            }
        };
        socket.on('end', cleanup).on('close', cleanup);
        request.on('end', cleanup).on('close', cleanup);
        var address = socket.remoteAddress + ":" + socket.remotePort;
        request.on('error', function (e) { return console.log('request for [' + address + '] error:', e); });
        socket.on('error', function (e) { return console.log('socket @ [' + address + '] error:', e); });
    };
    return TunnelClient;
}());
exports.TunnelClient = TunnelClient;
http.globalAgent.maxSockets = Infinity;
//# sourceMappingURL=tunnel.js.map