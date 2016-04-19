"use strict";
var net = require('net');
var http = require('http');
var https = require('https');
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
                _this.handleClient(socket, socket);
            }
            else {
                socket.end();
            }
        });
    };
    TunnelServer.prototype.listen = function (port, host) {
        this.server.listen.call(this.server, port, host);
    };
    TunnelServer.prototype.handleClient = function (upstream, downstream) {
        upstream.on('error', function (e) { return console.log('upstream error:', e); });
        downstream.on('error', function (e) { return console.log('downstream error:', e); });
        var proxy = net.connect(this.options.proxyPort, this.options.proxyHost, function () {
            proxy.pipe(downstream);
            upstream.pipe(proxy);
            console.log('proxy connected');
        });
        proxy.on('error', function (e) { return console.log('proxy error:', e); });
        var cleanup = function () {
            if (proxy.writable)
                proxy.end();
            if (downstream.writable)
                downstream.end();
            console.log('disconnect');
        };
        proxy.on('end', cleanup).on('close', cleanup);
        upstream.on('end', cleanup).on('close', cleanup);
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
    TunnelClient.prototype.bindTransport = function (socket) {
        var request = https.request({
            host: this.options.serverHost,
            port: this.options.serverPort,
            method: 'GET',
            headers: {
                'Upgrade': 'DOGS',
                'Connection': 'Upgrade'
            }
        });
        request.on('upgrade', function (resp, tunnel, head) {
            console.log("upgrade success:", resp.headers);
            tunnel.on('error', function (e) { return console.log('downstream error:', e); });
            if (resp.headers.upgrade != 'DOGS')
                tunnel.end();
            socket.pipe(tunnel);
            tunnel.pipe(socket);
        });
        request.flushHeaders();
        return request;
    };
    TunnelClient.prototype.handleClient = function (socket) {
        console.log("client online");
        var upstream = this.bindTransport(socket);
        var cleanup = function () {
            if (upstream.writable)
                upstream.end();
            if (socket.writable)
                socket.end();
            console.log('bye');
        };
        socket.on('end', cleanup).on('close', cleanup);
        upstream.on('end', cleanup).on('close', cleanup);
        var address = socket.remoteAddress + ":" + socket.remotePort;
        upstream.on('error', function (e) { return console.log('upstream for [' + address + '] error:', e); });
        socket.on('error', function (e) { return console.log('socket @ [' + address + '] error:', e); });
    };
    return TunnelClient;
}());
exports.TunnelClient = TunnelClient;
//# sourceMappingURL=tunnel.js.map