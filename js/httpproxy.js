var http = require('http');
function createHttpProxy() {
    return http.createServer(function (req, resp) {
        console.log(req.method, req.url, req.headers);
        if (req.method == 'CONNECT') {
            console.log('CONNECT', req);
        }
        else {
            resp.writeHead(404);
            resp.end('What are your looking for?');
        }
    });
}
exports.createHttpProxy = createHttpProxy;
//# sourceMappingURL=httpproxy.js.map