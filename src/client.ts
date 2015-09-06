import t = require('./tunnel');

// start client
t.connect({
	serverHost: '127.0.0.1',
	serverPort: 9000,
	transport: t.Transport.HTTP,
	accessKey: 'helloworld',
	password: 'anythingwhichisusedtoencryptthepackets'
}).listen(9001);