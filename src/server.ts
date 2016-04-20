import t = require('./tunnel');
import http = require('http');
import setup = require('proxy');

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
var server = setup(http.createServer());

server.listen(1080, '127.0.0.1', () => {
	console.log('proxy listening on 1080')
});