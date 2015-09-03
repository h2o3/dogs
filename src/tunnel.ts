import net = require('net');
import secure = require('./secure');

export interface ServerOptions {
    proxyHost: string;
    proxyPort: number;
    checkAccessKey: (key: string, cb: (pass: boolean, password?: string) => any) => any;
}

export interface ClientOptions {
    serverHost: string;
    serverPort: number;
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

    private server: net.Server;

    constructor(options: ServerOptions) {
        this.server = net.createServer(this.handleClient.bind(this));

        this.options = options;
    }

    listen(port: number, host?: string) {
        this.server.listen(port, host);
    }

    protected handShake(socket: net.Socket, callback: (password: string) => any) {
        var state = 0;
        var chunk: Buffer;

        var len: number;
        var key: string;

        var readableHandler = () => {
            // read length of key
            if (state == 0) {
                if ((chunk = <Buffer>socket.read(1)) != null) {
                    len = chunk.readUInt8(0);
                    state = 1;
                }
            }
            
            // read the key
            if (state == 1) {
                if ((chunk = <Buffer>socket.read(len)) != null) {
                    key = chunk.toString();
                    state = 2;
                }
            }
            
            // verify key and finish handshake
            if (state == 2) {
                socket.removeListener('readable', readableHandler);

                this.options.checkAccessKey(key, (pass: boolean, password?: string) => {
                    console.log('auth result: ', pass, ' with key:', key);

                    if (pass) {
                        callback(password);
                    } else {
                        socket.end();
                    }
                });
            }
        };

        socket.on('readable', readableHandler);
    }

    protected handleClient(client: net.Socket) {
        client.on('error', (e) => console.log('proxy error: ', e));

        this.handShake(client, (password) => {
            var proxy = net.connect(this.options.proxyPort, this.options.proxyHost, () => {
                var cipher = new secure.EncryptStream(password);
                var decipher = new secure.DecryptStream(password);

                proxy.pipe(cipher).pipe(client);
                client.pipe(decipher).pipe(proxy);
            });

            proxy.on('error', (e) => console.log('proxy error: ', e));

            client.on('close', () => {
                proxy.end();
            });

            proxy.on('close', () => {
                client.end();
            });
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

    protected handShake(socket: net.Socket, callback: () => any) {
        var keyBuffer = new Buffer(this.options.accessKey);

        var lenBuffer = new Buffer(1);
        lenBuffer.writeUInt8(keyBuffer.length, 0);

        socket.write(Buffer.concat([lenBuffer, keyBuffer]));

        callback();
    }

    protected handleClient(socket: net.Socket) {
        var address = socket.remoteAddress + ":" + socket.remotePort;

        var tunnel = net.connect(this.options.serverPort, this.options.serverHost, () => {
            this.handShake(tunnel, () => {
                var cipher = new secure.EncryptStream(this.options.password);
                var decipher = new secure.DecryptStream(this.options.password);

                socket.pipe(cipher).pipe(tunnel);
                tunnel.pipe(decipher).pipe(socket);
            });
        });

        tunnel.on('close', () => {
            socket.end();
        });

        socket.on('close', () => {
            tunnel.end();
        });

        tunnel.on('error', (e) => console.log('tunnel for [' + address + '] error: ', e));
        socket.on('error', (e) => console.log('tunnel for [' + address + '] error: ', e));
    }
}