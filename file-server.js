require('./common');
var http = require('http');
var socket_io = require('socket.io');
var serving = require('./serving');

exports.start = function(listenOn) {
    listeningOn = listenOn;
    srv.listen(listenOn.port, listenOn.ip, function onListen(){
        dbg('listening on port '+listenOn.port);
    });
};

/*
   SET UP THE HTTP SERVER
*/

var listeningOn; // keep track of the tcp coordinates we are currently accepting requests 

var srv = http.createServer(function(httpReq,httpRes){
    if (!serving.parseUrl(httpReq)) return;        

    var peer = httpReq.socket.address();
    dbg('serving '+peer.address+':'+peer.port+' '+httpReq.url);

    serving.serveStatic(httpReq, httpRes)
        || serveFromVFS(httpReq, httpRes);

});

srv.on('error', function(err){
    switch (err.code) {
        case 'EADDRINUSE':
            return dbg('port '+listeningOn.port+' busy');
    }
});

/*
    SET UP SOCKET.IO
*/

var io = socket_io.listen(srv);
misc.setupSocketIO(io);
io.sockets.on('connection', function(socket){
    socket.on('get list', function onGetList(data, cb){
        dbg('get list');
        vfs.fromUrl(data.path, function(fnode) {
            getReplyForFolder(fnode, cb);  
        });
    });
});

//////////////////////////////

function getReplyForFolder(folder, cb) {
    if (!folder) {
        return cb({error:'not found'});
    }
    folder.dir(function(items){
        assert(items, 'items');                
        // convert items to a simpler format
        items.forEach(function(f,name){             
            items[name] = { // we'll use short key names to save bandwidth on common fieldnames.
                // type
                t: f.itemKind.replace('virtual ',''), // this is a quick and dirty method to get value as file|folder|link
                // size
                s: f.stats.size,
            };
        });//forEach

        cb({items:items});    
    });//dir
} // getReplyForFolder

function serveFromVFS(httpReq, httpRes) {
    vfs.fromUrl(httpReq.uri, function urlCB(node){
        if (!node) {
            httpRes.writeHead(404);
            return httpRes.end();
        }

        if (node.isFile()) {
            return serving.serveFile(node.resource, httpRes, node.stats.size);  
        }
        
        assert(node.isFolder(), 'must be folder');
        // force trailing slash
        if (httpReq.url.substr(-1) != '/') { 
            httpRes.writeHead(301, {
                'Location': httpReq.url+'/'
            });
            return httpRes.end();
        }
        
        serving.serveFile('static/frontend.html', httpRes)
    });
} // serveFromVFS
