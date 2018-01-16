var http = require('http');
var url = require('url');
var hsh = require('./httpserverhandle');
var sessionmgr = require('./sessionmanager');
var websockserver = require('websocket').server;
var wsh = require('./websockethandle');
var logger = require('./logger');
var alg = require('./BoltzmannCounterAlg');
var mod = "appOrigin";


//HTTP server routing happens here
var server = http.createServer(function(req,res) {
	var params = url.parse(req.url, true);
	switch(params.pathname) {
		case '/host':	
			hsh.hostOperations(req,res);
			break;
		case '/singleplayergame':
			if(!hsh.isValidSession(req)) {				
				res.writeHead(307, {'Location':'/host'});
				res.end();
				logger.logit(mod,'warn','httpServerroute()','Invalid single player session from request='+JSON.stringify(req));
			}
			else {
				hsh.singlePlayerGame(req,res);
			}			
			break;
		case '/multiplayer':
			hsh.mpLobbyHandle(req,res);
			break;
		case '/join':
			hsh.joinOperations(req,res);
			break;
		case '/reqRPS': 
			if(hsh.isValidSession(req)) {
				hsh.processRPSImgRequest(req,res);
			}
			else {
				res.writeHead(307, {'Location':'/host'});
				res.end();
				logger.logit(mod,'warn','httpServerroute()','Invalid single player session from request='+JSON.stringify(req));
			}
			break;
		case '/computeranswer':
			if(hsh.isValidSession(req)) {
				hsh.computerAnswer(req,res,alg);
			}
			else {
				res.writeHead(307, {'Location':'/host'});
				res.end();
				logger.logit(mod,'warn','httpServerroute()','Invalid single player session from request='+JSON.stringify(req));
			}
			break;
		case '/postresult':
			if(hsh.isValidSession(req)) {
				hsh.storeMatchResult(req,res,alg);
			}
			else {
				res.writeHead(307, {'Location':'/host'});
				res.end();
				logger.logit(mod,'warn','httpServerroute()','Invalid single player session from request='+JSON.stringify(req));
			}
		case '/wp':
			hsh.validateMPSession(req,res);
			break;
		case '/':
			hsh.serveIndex(req,res);
			break;
		case '/about':
			hsh.serveAbout(req,res);
			break;
		case '/Robots.txt':
			hsh.giverobot(req,res);
			break;
		default:
			hsh.serveStaticContent(req,res,params.pathname);
			break;
	}
});

//listen
server.listen(process.env.PORT || 5000);

//connect to redis 
alg.connectRedis();
//register loggers
logger.configLogger('appOrigin');
hsh.registerLogger('httpserverhandle',logger);
wsh.registerLogger('websockethandle',logger);
//run single player garbage collector
hsh.sessiongc();

//configure Websocket server
wsServer = new websockserver({
	httpServer: server,
	autoAcceptConnections: false
});

//connect and respond to websocket request from client
wsServer.on('request', function (req) {
	var con = req.accept(null, req.origin);	
	//handle messages from peer and route them accordingly. 
	con.on('message', function(msg) {
		logger.logit(mod,'info','wsProcessMessageListener()','(onmessage event) PEER Message:='+msg.utf8Data);
		if(msg.type === 'utf8') {
			var peerMsg = JSON.parse(msg.utf8Data);
			switch(peerMsg['type']) {
				case 'report':
					wsh.registerConnection(msg.utf8Data,con,function(stat) {
						if(!stat) {
							con.close(5001,'Invalid Session');
							logger.logit(mod,'warn','wsProcessMessageListener()','Invalid session was detected');
						}
						else {
							wsh.sendStatus(peerMsg['sessionid']);
						}
					});
					break;
				case 'chat':
					wsh.chat(peerMsg);
					break;
				case 'readytoplay':
					wsh.signalReady(peerMsg);
					break;
				case 'startround':
					wsh.startRound(peerMsg);
					break;
				case 'playeranswer':
					wsh.evaluateAnswer(peerMsg);
					break;
				case 'anotherroundvote':
					wsh.voteAnotherRound(peerMsg);
			}
		}
		else if(msg.type === 'binary') {
			logger.logit(mod,'info','wsRequestListener()','Message:='+msg.binary);
			con.sendBytes(msg.binaryData);
		}
	});
	//handle close of websocket connection by notifying the guy who is still connected that the other guy is disconnected
	con.on('close',function(reasonCode, description) {
		if(reasonCode == 1001 && description == 'Remote peer is going away') {
			wsh.handleClosedConnections(con);
			logger.logit(mod,'info','wsConnectionCloseListener()','connection closed. request='+JSON.stringify(req)+'reasoncode='+reasonCode+'reason description='+description);
		}
    });
});
