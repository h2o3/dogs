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

enum State {
    READ_KEY_LEN, READ_KEY, AUTH, FORWARD, AUTH_FAIL
}

export class TunnelServer {
    private options: ServerOptions;

    private server: net.Server | http.Server;

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
                resp.writeHead(200, { 'content-type': 'text/plain' });
                resp.end('ok');
            });

            this.server.on('upgrade', (req: http.IncomingMessage, socket: net.Socket, head: Buffer) => {
                if (req.headers.upgrade == 'DOGS') {
                    socket.write('HTTP/1.1 101 Switching protocol\r\n' +
                        'Upgrade: DOGS\r\n' +
                        'Connection: Upgrade\r\n' +
                        '\r\n');

                    this.handleClient(socket, socket);
                } else {
                    socket.end();
                }
            });
        }
    }

    listen(port: number, host?: string) {
        this.server.listen.call(this.server, port, host);
    }

    protected handleClient(upstream: stream.Readable, downstream: stream.Writable) {
        var len: number;
        var key: string;

        var cipher: secure.EncryptStream;
        var decipher: secure.DecryptStream;

        var proxy: net.Socket;

        var consumer = new reader.Reader(State.READ_KEY_LEN, [
            {
                state: State.READ_KEY_LEN,
                count: () => 1,
                action: (cb: reader.ConsumeCb<State>, buffer?: Buffer) => {
                    len = buffer.readUInt8(0);
                    cb(State.READ_KEY);
                }
            },
            {
                state: State.READ_KEY,
                count: () => len,
                action: (cb: reader.ConsumeCb<State>, buffer?: Buffer) => {
                    key = buffer.slice(0, len).toString();
                    cb(State.AUTH);
                }
            },
            {
                state: State.AUTH,
                count: () => 0,
                action: (cb: reader.ConsumeCb<State>, buffer?: Buffer) => {
                    this.options.checkAccessKey(key, (pass: boolean, password?: string) => {
                        console.log('auth result:', pass, ' with key:', key);

                        if (pass) {
                            cipher = new secure.EncryptStream(password);
                            decipher = new secure.DecryptStream(password);

                            proxy = net.connect(this.options.proxyPort, this.options.proxyHost, () => {
                                proxy.pipe(cipher).pipe(downstream);
                                decipher.pipe(proxy);
                            });
                            proxy.on('error', (e) => console.log('proxy error:', e));

                            var cleanup = () => {
                                if (proxy.writable) proxy.end();
                                if (downstream.writable) downstream.end();
                            };
                            proxy.on('end', cleanup).on('close', cleanup);
                            upstream.on('end', cleanup).on('close', cleanup);

                            cb(State.FORWARD);
                        } else {
                            cb(State.AUTH_FAIL);
                        }
                    });
                }
            },
            {
                state: State.FORWARD,
                count: () => Number.MAX_VALUE,
                action: (cb: reader.ConsumeCb<State>, buffer?: Buffer) => {
                    // forward data to proxy
                    decipher.write(buffer);
                    cb(State.FORWARD);
                }
            },
            {
                state: State.AUTH_FAIL,
                count: () => 0,
                action: (cb: reader.ConsumeCb<State>, buffer?: Buffer) => {
                    downstream.end();
                }
            }
        ]);

        var dataHandler = () => {
            var data = <Buffer>upstream.read();
            if (data) {
                consumer.feed(data);
                consumer.consumeAll();
            }
        };
        upstream.on('readable', dataHandler);

        upstream.on('error', (e) => console.log('upstream error:', e));
        downstream.on('error', (e) => console.log('downstream error:', e))
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
                method: 'GET',
                headers: {
                    'Upgrade': 'DOGS',
                    'Connection': 'Upgrade'
                }
            });

            request.on('upgrade', (resp: http.ClientResponse, tunnel: net.Socket, head: Buffer) => {
                tunnel.on('error', (e) => console.log('downstream error:', e));

                if (resp.headers.upgrade != 'DOGS') tunnel.end();

                this.handShake(tunnel, () => {
                    socket.pipe(cipher).pipe(tunnel);
                });

                tunnel.pipe(decipher).pipe(socket);
            });
            request.flushHeaders();

            return request;
        }
    }

    protected handleClient(socket: net.Socket) {
        var address = socket.remoteAddress + ":" + socket.remotePort;

        var upstream = this.bindTransport(socket);

        var cleanup = () => {
            if (upstream.writable) upstream.end();
            if (socket.writable) socket.end();
        }

        socket.on('close', cleanup);

        upstream.on('error', (e) => console.log('upstream for [' + address + '] error:', e));
        socket.on('error', (e) => console.log('socket @ [' + address + '] error:', e));
    }
}