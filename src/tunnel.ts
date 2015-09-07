import net = require('net');
import http = require('http');
import stream = require('stream');
import secure = require('./secure');
import reader = require('./reader');

export enum Transport {
    TCP, HTTP
}

export interface ServerOptions {
    proxyHost: string;
    proxyPort: number;
    transport: Transport;
    checkAccessKey: (key: string, cb: (pass: boolean, password?: string) => any) => any;
}

export interface ClientOptions {
    serverHost: string;
    serverPort: number;
    transport: Transport;
    accessKey: string;
    password: string;
}

export function createServer(options: ServerOptions) {
    return new TunnelServer(options);
}

export function connect(options: ClientOptions) {
    return new TunnelClient(options);
}

export class TunnelServer {
    private options: ServerOptions;

    private server: net.Server|http.Server;

    constructor(options: ServerOptions) {
        this.options = options;
        this.initTransport();
    }

    protected initTransport(): void {
        if (this.options.transport == Transport.TCP) {
            this.server = net.createServer((socket) => {
                this.handleClient(socket, socket);
            });
        } else {
            this.server = http.createServer((req, resp) => {
                resp.writeHead(200, { 'content-type': 'application/stream' });

                this.handleClient(req, resp);
            });
        }
    }

    listen(port: number, host?: string) {
        this.server.listen.call(this.server, port, host);
    }

    protected handShake(upstream: stream.Readable, downstream: stream.Writable, callback: (remain: Buffer, password: string) => any) {
        var len: number;
        var key: string;

        var consumer = new reader.Reader();
        var consumeSpec = [
            {
                state: 0,
                target: 1,
                count: () => 1,
                action: (buffer?: Buffer) => {
                    len = buffer.readUInt8(0);
                }
            },
            {
                state: 1,
                target: 2,
                count: () => len,
                action: (buffer?: Buffer) => {
                    key = buffer.slice(0, len).toString();
                }
            },
            {
                state: 2,
                target: 3,
                count: () => 0,
                action: (buffer?: Buffer) => {
                    upstream.removeListener('readable', dataHandler);
                    
                    this.options.checkAccessKey(key, (pass: boolean, password?: string) => {
                        console.log('auth result: ', pass, ' with key:', key);

                        if (pass) {
                            callback(consumer.remain(), password);
                        } else {
                            downstream.end();
                        }
                    });
                }
            }
        ];

        var dataHandler = () => {
            var data = <Buffer>upstream.read();
            consumer.feed(data);
            consumer.consumeAll(consumeSpec);
        };

        upstream.on('readable', dataHandler);
    }

    protected handleClient(upstream: stream.Readable, downstream: stream.Writable) {
        upstream.on('error', (e) => console.log('upstream error:', e));
        downstream.on('error', (e) => console.log('downstream error:', e))

        this.handShake(upstream, downstream, (remain, password) => {
            var cipher = new secure.EncryptStream(password);
            var decipher = new secure.DecryptStream(password);            
            
            var proxy = net.connect(this.options.proxyPort, this.options.proxyHost, () => {
                proxy.pipe(cipher).pipe(downstream);
                decipher.pipe(proxy);
                
                decipher.write(remain);
                
                upstream.on('readable', () => {
                    var chunk;
                    while((chunk = upstream.read()) != null) {
                        console.log('read:', chunk);
                        decipher.write(chunk);
                    }
                });
            });

            upstream.on('close', () => proxy.end());
            proxy.on('close', () => downstream.end());
            proxy.on('error', (e) => console.log('proxy error: ', e));
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

    protected handShake(upstream: stream.Writable, callback: () => any) {
        var keyBuffer = new Buffer(this.options.accessKey);

        var lenBuffer = new Buffer(1);
        lenBuffer.writeUInt8(keyBuffer.length, 0);

        upstream.write(Buffer.concat([lenBuffer, keyBuffer]));

        callback();
    }

    protected bindTransport(socket: net.Socket): stream.Writable {
        if (this.options.transport == Transport.TCP) {
            var tunnel = net.connect(this.options.serverPort, this.options.serverHost, () => {
                this.handShake(tunnel, () => {
                    var cipher = new secure.EncryptStream(this.options.password);
                    var decipher = new secure.DecryptStream(this.options.password);

                    socket.pipe(cipher).pipe(tunnel);
                    tunnel.pipe(decipher).pipe(socket);
                });
            });
            return tunnel;
        } else {
            var cipher = new secure.EncryptStream(this.options.password);
            var decipher = new secure.DecryptStream(this.options.password);

            var request = http.request({
                host: this.options.serverHost,
                port: this.options.serverPort,
                method: 'POST'
            }, (resp) => {
                resp.on('error', (e) => console.log('downstream error:', e));
                resp.pipe(decipher).pipe(socket);
            });

            this.handShake(request, () => {
                socket.pipe(cipher).pipe(request);
            });

            return request;
        }
    }

    protected handleClient(socket: net.Socket) {
        var address = socket.remoteAddress + ":" + socket.remotePort;

        var upstream = this.bindTransport(socket);

        upstream.on('close', () => socket.end());
        socket.on('close', () => upstream.end());
        upstream.on('error', (e) => console.log('upstream for [' + address + '] error:', e));
        socket.on('error', (e) => console.log('socket @ [' + address + '] error:', e));
    }
}