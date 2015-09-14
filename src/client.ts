import t = require('./tunnel');

var serverHost = '127.0.0.1';
var serverPort = 9000;

if (process.argv.length == 4) {
	serverHost = process.argv[2];
	serverPort = parseInt(process.argv[3]);
}

// start client
t.connect({
	serverHost: serverHost,
	serverPort: serverPort,
	transport: t.Transport.HTTP,
	accessKey: 'helloworld',
	password: 'anythingwhichisusedtoencryptthepackets'
}).listen(9001);