declare module 'proxy' {
    import http = require('http');

    function setup(server: http.Server): http.Server;
    
    export = setup;
}