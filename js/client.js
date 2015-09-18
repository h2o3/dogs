var t = require('./tunnel');
var transport = t.Transport.TCP;
var serverHost = '127.0.0.1';
var serverPort = 9000;
if (process.argv.length >= 4) {
    serverHost = process.argv[2];
    serverPort = parseInt(process.argv[3]);
    if (process.argv.length >= 5 && process.argv[4] == 'HTTP')
        transport = t.Transport.HTTP;
}
// start client
t.connect({
    serverHost: serverHost,
    serverPort: serverPort,
    transport: transport,
    accessKey: 'helloworld',
    password: 'anythingwhichisusedtoencryptthepackets'
}).listen(9001);
//# sourceMappingURL=client.js.map