import t = require('./tunnel');
import socks = require('socksv5');

var port = 9000;

if (process.argv.length >= 3) {
	port = parseInt(process.argv[2]);
}

// start server
t.createServer({
	proxyHost: '127.0.0.1',
	proxyPort: 1080
}).listen(port);

// start proxy server
var server = socks.createServer((info, accept, deny) => {
	console.log("proxy", info.dstAddr);
	accept();
});

server.listen(1080, '127.0.0.1', () => {
	console.log('socksv5 listening on 1080')
});
server.useAuth(socks.auth.None());