import t = require('./tunnel');
import socks = require('socksv5');

// start server
new t.TunnelServer('127.0.0.1', 1080);

// start proxy server
var server = socks.createServer((info, accept, deny) => {
	console.log("proxy", info);
	accept();
});

server.listen(1080, '127.0.0.1')
server.useAuth(socks.auth.None());