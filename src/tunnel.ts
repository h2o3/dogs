import net = require('net');
import http = require('http');
import https = require('https');
import stream = require('stream');

export interface ServerOptions {
    proxyHost: string;
    proxyPort: number;
}

export interface ClientOptions {
    serverHost: string;
    serverPort: number;
}

export function createServer(options: ServerOptions) {
    return new TunnelServer(options);
}

export function connect(options: ClientOptions) {
    return new TunnelClient(options);
}

export class TunnelServer {
    private options: ServerOptions;

    private server: http.Server;

    constructor(options: ServerOptions) {
        this.options = options;
        this.initTransport();
    }

    protected initTransport(): void {
        this.server = http.createServer((req, resp) => {
            resp.writeHead(200, { 'content-type': 'text/plain' });
            resp.end('ok');
        });

        this.server.on('upgrade', (req: http.IncomingMessage, socket: net.Socket, head: Buffer) => {
            if (req.headers.upgrade == 'DOGS') {
                socket.write('HTTP/1.1 101 Switching protocol\r\n' +
                    'Upgrade: DOGS\r\n' +
                    'Connection: Upgrade\r\n' +
                    '\r\n');

                this.handleClient(socket, head);
            } else {
                socket.end();
            }
        });
    }

    listen(port: number, host?: string) {
        this.server.listen.call(this.server, port, host);
    }

    protected handleClient(socket: net.Socket, head: Buffer) {
        socket.on('error', (e) => console.log('socket error:', e));

        var proxy = net.connect(this.options.proxyPort, this.options.proxyHost, () => {
            proxy.write(head);

            proxy.pipe(socket);
            socket.pipe(proxy);
        });
        proxy.on('error', (e) => console.log('proxy error:', e));

        var cleanup = () => {
            if (proxy.writable) proxy.end();
            if (socket.writable) socket.end();
        };
        proxy.on('end', cleanup).on('close', cleanup);
        socket.on('end', cleanup).on('close', cleanup);
    }
}

export class TunnelClient {
    private options: ClientOptions;

    private listenServer: net.Server;

    constructor(options: ClientOptions) {
        this.listenServer = net.createServer(this.handleClient.bind(this));

        this.options = options;
    }

    listen(port: number, host?: string) {
        this.listenServer.listen(port, host);
    }

    protected handleClient(socket: net.Socket) {
        var request = https.request({
            host: this.options.serverHost,
            port: this.options.serverPort,
            method: 'GET',
            headers: {
                'Upgrade': 'DOGS',
                'Connection': 'Upgrade'
            }
        });

        request.on('upgrade', (resp: http.ClientResponse, tunnel: net.Socket, head: Buffer) => {
            tunnel.on('error', (e) => console.log('tunnel error:', e));

            if (resp.headers.upgrade != 'DOGS') tunnel.end();

            socket.pipe(tunnel);
            tunnel.pipe(socket);
        });
        request.flushHeaders();

        var cleanup = function () {
            if (request.writable) request.end();
            if (this == socket) {
                if (socket.writable) socket.end();
            } else {
                setTimeout(function () { if (socket.writable) socket.end(); }, 1000);
            }
        }

        socket.on('end', cleanup).on('close', cleanup);
        request.on('end', cleanup).on('close', cleanup);

        var address = socket.remoteAddress + ":" + socket.remotePort;
        request.on('error', (e) => console.log('request for [' + address + '] error:', e));
        socket.on('error', (e) => console.log('socket @ [' + address + '] error:', e));
    }
}

http.globalAgent.maxSockets = Infinity;