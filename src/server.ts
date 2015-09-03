import t = require('./tunnel');
import socks = require('socksv5');

// start server
t.createServer({
	proxyHost: '127.0.0.1',
	proxyPort: 1080,
	checkAccessKey: (key, cb) => {
		cb(key == 'helloworld', 'anythingwhichisusedtoencryptthepackets');
	}
}).listen(9000);

// start proxy server
var server = socks.createServer((info, accept, deny) => {
	console.log("proxy", info.dstAddr);
	accept();
});

server.listen(1080, '127.0.0.1');
server.useAuth(socks.auth.None());