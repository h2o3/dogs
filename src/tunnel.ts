import net = require('net');
import tls = require('tls');
import fs = require('fs');
import events = require('events');

export class TunnelServer {
    private proxyPort: number;
    private proxyHost: string;

    constructor(host, port) {
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

    handleClient(client: tls.ClearTextStream) {
        var proxy = net.connect(this.proxyPort, this.proxyHost, function() {
            client.pipe(proxy);
            proxy.pipe(client)
        });

        client.on('close', () => {
            console.log('client connection closed');
            proxy.end();
        });

        proxy.on('close', () => {
            console.log('proxy connection closed');
            client.end();
        });

        proxy.on('error', (e) => console.log('proxy error: ', e));
        client.on('error', (e) => console.log('proxy error: ', e));
    }
}

export class TunnelClient {
    private tunnelHost: string;
    private tunnelPort: number;

    constructor(host, port) {
        var server = net.createServer(this.handleClient.bind(this));
        server.listen(9001);

        this.tunnelHost = host;
        this.tunnelPort = port;
    }

    handleClient(socket: net.Socket) {
        var address = socket.remoteAddress + ":" + socket.remotePort;

        var tunnel = tls.connect(this.tunnelPort, this.tunnelHost, {
            key: fs.readFileSync('keys/client-key.pem'),
            cert: fs.readFileSync('keys/client-cert.pem'),
            ca: [fs.readFileSync('keys/server-cert.pem')],
            checkServerIdentity: function(host, cert) {
                return undefined;
            }
        }, () => {
            socket.pipe(tunnel);
            tunnel.pipe(socket);
        });

        tunnel.on('close', () => {
            console.log('tunnel for [' + address + '] disconnected');
            socket.end();
        });

        socket.on('close', () => {
            console.log('connection [' + address + '] disconnected');
            tunnel.end();
        });

        tunnel.on('error', (e) => console.log('tunnel for [' + address + '] error: ', e));
        socket.on('error', (e) => console.log('tunnel for [' + address + '] error: ', e));
    }
}