import net = require('net');
import tls = require('tls');
import fs = require('fs');
import events = require('events');

export interface ServerOptions {
    proxyHost: string;
    proxyPort: number;
    checkAccessKey: (key: string, cb: (pass: boolean) => any) => any;
}

export interface ClientOptions {
    serverHost: string;
    serverPort: number;
    accessKey: string;
}

export function createServer(options: ServerOptions) {
    return new TunnelServer(options);
}

export function connect(options: ClientOptions) {
    return new TunnelClient(options);
}

export class TunnelServer {
    private options: ServerOptions;

    private tlsServer: tls.Server;

    constructor(options: ServerOptions) {
        var tlsOptions = {
            key: fs.readFileSync('keys/server-key.pem'),
            cert: fs.readFileSync('keys/server-cert.pem'),
            ca: [fs.readFileSync('keys/client-cert.pem')]
        };

        this.tlsServer = tls.createServer(tlsOptions, this.handleClient.bind(this));

        this.options = options;
    }

    listen(port: number, host?: string) {
        this.tlsServer.listen(port, host);
    }

    handShake(socket: tls.ClearTextStream, callback: () => any) {
        var state = 0;
        var chunk: Buffer;

        var len: number;
        var key: string;

        var readableHandler = () => {
            if (state == 0) {
                if ((chunk = <Buffer>socket.read(1)) != null) {
                    len = chunk.readUInt8(0);
                    state = 1;
                }
            } else if (state == 1) {
                if ((chunk = <Buffer>socket.read(len)) != null) {
                    key = chunk.toString();
                    socket.removeListener('readable', readableHandler);

                    this.options.checkAccessKey(key, (pass: boolean) => {
                        console.log('auth result: ', pass, ' with key:', key);

                        if (pass) {
                            callback();
                        } else {
                            socket.end();
                        }
                    });
                }
            }
        };

        socket.on('readable', readableHandler);
    }

    handleClient(client: tls.ClearTextStream) {
        this.handShake(client, () => {
            var proxy = net.connect(this.options.proxyPort, this.options.proxyHost, function() {
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
        });
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

    handShake(socket: tls.ClearTextStream, callback: () => any) {
        var keyBuffer = new Buffer(this.options.accessKey);

        var lenBuffer = new Buffer(1);
        lenBuffer.writeUInt8(keyBuffer.length, 0);

        socket.write(lenBuffer);
        socket.write(keyBuffer);

        callback();
    }

    handleClient(socket: net.Socket) {
        var address = socket.remoteAddress + ":" + socket.remotePort;

        var tunnel = tls.connect(this.options.serverPort, this.options.serverHost, {
            key: fs.readFileSync('keys/client-key.pem'),
            cert: fs.readFileSync('keys/client-cert.pem'),
            ca: [fs.readFileSync('keys/server-cert.pem')],
            checkServerIdentity: function(host, cert) {
                return undefined;
            }
        }, () => {
            this.handShake(tunnel, () => {
                socket.pipe(tunnel);
                tunnel.pipe(socket);
            });
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