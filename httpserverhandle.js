//this module handles and implements the http calls made by router of http server. essentially talks to model and passes JSON data to the view, and does protocol upgrade negotiation as well to start multiplayer game

var sessionmgr = require('./sessionmanager');
var msessionmgr = require('./multiplayersessionmanager');
var path = require('path');

var fs = require('fs');
var ris = require('./randomimageselect');
var url = require('url');
var qs = require('querystring');
var logger,module;

exports.isValidSession = isValidSession;
exports.hostOperations = hostOperations;
exports.singlePlayerGame = singlePlayerGame;
exports.processRPSImgRequest = processRPSImgRequest;
exports.computerAnswer = computerAnswer;
exports.storeMatchResult = storeMatchResult;
exports.serveStaticContent = serveStaticContent;
exports.joinOperations = joinOperations;
exports.mpLobbyHandle = mpLobbyHandle;
exports.validateMPSession = validateMPSession;
exports.serveIndex = serveIndex;
exports.serveAbout = serveAbout;
exports.giverobot = giverobot;
exports.sessiongc = sessiongc;
exports.registerLogger = registerLogger;

//ready to write messages
function registerLogger(moduleName,loggerInstance) {
	loggerInstance.configLogger(moduleName);
	sessionmgr.registerLogger('singleplayer-sessionmanager',loggerInstance);
	msessionmgr.registerLogger('multiplayer-sessionmanager',loggerInstance);
	module = moduleName;
	logger = loggerInstance;
}

//forwarder to call singleplayer session garbage collector. Basically, since HTTP is stateless, I would not know if the user has closed the window and stopped playing or not, especially Since I am making any polling. So, the the sessiongc will remove session from the session collection if it sees that it's been inactive for more than 5 mins
function sessiongc() {
	sessionmgr.sessiongc();
}

//serve about.html page TODO: delegate this to servestatic content method
function serveAbout(req,res) {
	res.writeHead(200, {"content-type":"text/html;charset=utf-8"});
	fs.createReadStream('html/about.html').pipe(res);
	logger.logit(module,'info',"serverAbout()",JSON.stringify(req.connection.remoteAddress)+"requested for about page");
}

//serve robots.txt file 
function giverobot(req,res) {
	res.writeHead(200, {"content-type":"text/plain;charset=utf-8"});
	fs.createReadStream('Robots.txt').pipe(res);
	logger.logit(module,'info',"giverobot()",JSON.stringify(req.connection.remoteAddress)+"requested for robots");
}

//serve index page
function serveIndex(req,res) {
	res.writeHead(200, {"content-type":"text/html;charset=utf-8"});
	fs.createReadStream('html/index.html').pipe(res);
	logger.logit(module,'info',"serveIndex()",JSON.stringify(req.connection.remoteAddress)+"requested for Index");
}

//validate if the multiplayer session is meant for this user or not
function validateMPSession(req,res) {
	var params = url.parse(req.url, true);
	msessionmgr.isValidmSessionVerify(params.query.gsi,params.query.un,function(stat) {
		var resJSON = {};
		if(stat) {
			resJSON['stat'] ='OK';
		}
		else {
			resJSON['stat'] ='FAIL';
		}
		res.end(JSON.stringify(resJSON));	
		logger.logit(module,'info',"validateMPSession()","MPSession validation result"+JSON.stringify(resJSON));
	});
}

//get ready to enter the Multiplayer lobby, for both players to enter the lobby, players have to post their sessionid and usernames to the server, if they fail to do so or do it twice, the session becomes invalid and both players exit the lobby. Once the players are verified and it's determined that they are meant to play together they are given the multiplayer.html page with negotiates a protocol upgrade to websockets. TODO: refactor and break the function into smaller functions
function mpLobbyHandle(req,res) {
	var d='';
	if(req.method != 'POST') {
		res.writeHead(405,{'Content-Type':'text/plain;charset=utf-8'});
		res.end("Operation Not Permitted");
		logger.logit(module,'warn',"mpLobbyHandle()","req tried illegal way of entering the lobby. req="+JSON.stringify(req.connection.remoteAddress));
	}
	else {
		req.on('data',function(data) {
			d +=data;
			//body is too large ... WTF?! something is wrong .. destroy connection
			if(d.length > 1e6) {
				d = '';
				req.connection.destroy();
			}				
		});
		//POST body recieved, now verify
		req.on('end',function() {
			var postIp = qs.parse(d);
			logger.logit(module,'info',"mpLobbyHandle()","::roomcode="+postIp['roomcode']+"::username="+postIp['username']);
			msessionmgr.isValidmSession(postIp['roomcode'],function(stat) {
				if(stat) {
					var ref = JSON.stringify(req.headers.referer);
					if((ref.indexOf("/host") > -1) 
					|| (ref.indexOf("/join") > -1)) {
						msessionmgr.setWebSocketReady(postIp['roomcode']);
						res.writeHead(200,[
							["Set-Cookie","gamesessionid="+postIp["roomcode"]],
							["Set-Cookie","username="+postIp["username"]]
						]);
						//set cookie for future communication and send html page that contains multiplayer controller and view (view and controller are totally seperate)
						fs.createReadStream("html/multiplayer.html").pipe(res);
					}
					else {
						res.writeHead(403);
						res.end("<h1>403 Not authorized</h1>");
						logger.logit(module,'warn',"mpLobbyHandle()","403 for request req="+JSON.stringify(req));
			
					}	
				}
				else {
					res.writeHead(403);
					res.end("<h1>403 Not authorized</h1>");
					logger.logit(module,'warn',"mpLobbyHandle()","403 for request req="+JSON.stringify(req));
				}
			});
		});
	}
}

//send the web-page containing the controller and view to allow user to join the game
function joinOperations(req,res) {
	var params = url.parse(req.url, true);
	if(params.query.n == null) {
		res.writeHead(200,{'content':'text/html;charset=utf-8'});
		fs.createReadStream('html/join.html').pipe(res);
	}
	else {
		msessionmgr.joinMultiPlayerSession(params.query.n,
		params.query.a,
		params.query.e,
		params.query.gc,
		function(error,sessionid) {
			if(error == null) {
				var jsonRes = {
					'status':'OK',
					'roomcode':sessionid
				};
				res.writeHead(200,{'content':'application/json;charset=utf-8'});
				res.end(JSON.stringify(jsonRes));
				logger.logit(module,'info',"joinOperation()","join valid for "+sessionid+","+params.query.n);
			}
			else {
				var jsonRes = {
					'status':'NOT VALID'
				};
				res.writeHead(200,{'content':'application/json;charset=utf-8'});
				res.end(JSON.stringify(jsonRes));
				logger.logit(module,'info',"joinOperation()","join invalid for "+params.query.n);
			}
		});
	}		
}

//look at cookie and get sessionid
function getSessionIdFromRequestHeaders(req) {
	if(req.headers["cookie"] == null) 
		return null;	
	var cookieS = JSON.stringify(req.headers["cookie"]).toString().split(";");
	var sessionid;
	for(var i=0;i<cookieS.length;i++) {
		if(cookieS[i].search("gamesessionid") > -1) {
			sessionid = cookieS[i].split("=")[1];
			sessionid = sessionid.replace('"','');
		}
	}
	return sessionid;
}

//verify is single player session is valid or not. a session gets invalid after 5 mins of non-usage
function isValidSession(req) {
	var sessionid = getSessionIdFromRequestHeaders(req);	
	logger.logit(module,'info',"isvalidsession()","referer="+JSON.stringify(req.headers.referer));
	if(sessionid == null)
		return false;
	else {
		var ivs = sessionmgr.checkIfSessionIsValid(sessionid);
		return ivs;
	}
}

//store the result of the round TODO: change the name to round result. name is confusing. there is no matching going on
function storeMatchResult(req,res,alg) {
	var params = url.parse(req.url, true);	
	var sessionid= getSessionIdFromRequestHeaders(req);
	sessionmgr.setScore(params.query.uc, params.query.r,params.query.ht,sessionid, alg, function(score) {
		res.writeHead(200,{'content':'application/json;charset=utf-8'});
		var jsonRes = {};
		jsonRes["cscore"] = score['cscore'];
		jsonRes["pscore"] = score['pscore'];
		jsonRes["hideTable"] = score['hideTable'];
		res.end(JSON.stringify(jsonRes));
	});	
}

//call the boltzmann counting alg and get the boltzmann machine's answer single player usage only TODO: implement other algorithms and let user choose what alg he/she wants to play against
function computerAnswer(req,res,alg) {
	var compCh;	
	sessionmgr.getUserDetails(getSessionIdFromRequestHeaders(req),function(uname,uage){
		//use algo. alg has access to redis where it checks the past answers from players and decides what to pick and passes the most best output to the callback
		alg.getBestChoice(uname,uage,function(compCh){
			var jsonRes = {};
			jsonRes["computerResponse"] = compCh;
			res.writeHead(200,{"content-type":"application/json;charset=utf-8"});
			res.end(JSON.stringify(jsonRes));
		});		
	});	
}

//call RPSimageRequest module and get random images for rock,paper,scissors from google image search
function processRPSImgRequest(req,res) {
	var userip = req.connection.remoteAddress;
	logger.logit(module,'info','processRPSImgRequest()',"userip="+userip);
	if(userip == null) {
		userip = req.headers['x-forwarded-for'];
		logger.logit(module,'info',"processRPSImgRequest()","userip="+userip);
	}
	ris(userip,function(jsonResult) {
		res.end(JSON.stringify(jsonResult));
		logger.logit(module,'info',"processRPSImgRequest()",'call complete');
	});
}

//check and serve any resource that is not defined in the route, if it exists because most likely the resource is going to be a static asset
function serveStaticContent(req,res,path) {
	//TODO: handle multiplayer 304 and then uncomment singleplayer 304
	logger.logit(module,'info',"serveStaticContent()","path requested=:"+path.toString().substring(1));
	fs.readFile(path.toString().substring(1),readAndSend);
	function readAndSend(error,data) {
		if(error) {
			res.writeHead(404);
			res.end();
		}
		else {
			//sessionid = getSessionIdFromRequestHeaders(req);
			//console.log("readandsend():"+sessionid);
			//sessionmgr.checkServedFile(sessionid,path.toString(),function(err,result) {
				//console.log("checkServedFile():"+err+" "+result);
				//if(err == null) {
					//if(result) {
						//res.writeHead(304);
						//res.end();
					//}
					//else {						
						sessionmgr.etagSig(path.toString().substring(1), 
						function(sha) {
							res.writeHead(200,{"Cache-Control": "max-age=30000","ETag":sha,"Content-Length":data.length});
							res.end(data);
						});
						//sessionmgr.addServedFile(sessionid,path.toString());
					//}	
				}				
				//else if(err != null) {
					//console.log("ERROR:"+error);
					//res.writeHead(500);
					//res.end(err);
				//}
			}
		//}
	//}
}

//serve the singleplayer game html file. it contains the controller and view to handle client side of single player game
function singlePlayerGame(req,res) {
	res.writeHead(200, {"content-type":"text/html;charset=utf-8"});
	fs.createReadStream("html/singleplayer.html").pipe(res);
}


//player wants to host a game. handle the request here
function hostOperations(req,res) {
	var params = url.parse(req.url, true);
	//if there is no username, show him the host.html page, which has a form which can be filled and host a new game
	if(params.query.un == null) {
		res.writeHead(200, {"content-type":"text/html;charset=utf-8"});
		fs.createReadStream("html/host.html").pipe(res);
	}
	
	//after user fills the form XMLHttpRequest is made to the same route but with parameters containing the player information and preferences. decide according to the players preferences
	else {		
	    //player wants to player multiplayer game. send the gamesessionid to the player
		if(params.query.mode=="mp") {
			var resHTML = '';
			var msession = msessionmgr.createMultiPlayerSession(params.query.un,params.query.ua,params.query.pe);
			//TODO: REDO and REFACTOR THIS!WTF SEND JSON NOT HTML!!! 			
			resHTML += "<div class='panel panel-default'><div class='panel-body'><h3>Your game room code is: <strong>"+msession['game-code']+"</strong></h3></div>";
			resHTML += "<div class='panel-body'>Ask your friend to go to <strong>https://rps-online.herokuapp.com/join</strong> and enter the game room code.";
			resHTML += "You can go inside the Game Lobby and wait. Once your friend joins, you'll be able to see them in the lobby as well.</div>";
			resHTML += "<input hidden id='v' value='"+msession['msessionid']+"'/>";
			resHTML += "<input hidden id='u' value='"+msession['host-name']+"'/>";
			resHTML += "<div class='panel-body pull-right'><input type='button' id='startmp' onclick='startmp()' class='btn btn-primary btn-lg' value='Start'></input></div></div>";
			res.writeHead(200, {"content-type":"text/html","content-length":resHTML.length});
			res.end(resHTML);
		}
		//player wants to playe single player send gamesessionid to the player and some html
		//TODO: REDO and REFACTOR THIS!WTF SEND JSON NOT HTML!!! 
		if(params.query.mode=="sp") {			
			var session = sessionmgr.createSinglePlayerSession(params.query.un,params.query.ua);
			sessionmgr.addSession(session);
			resHTML += "<div class='panel panel-default'>";
			resHTML += "<div class=' panel-body content row'><h3>Sup <strong>"+params.query.un+"</strong> Start your game by clicking on the Ready button below</h3></div>";
			resHTML += "<div class='panel-body content row span3 pull-right'><input type='button' id='ready' onclick='startsingleplayer()' class='btn btn-primary btn-lg' value='start'/></div>";
			res.writeHead(200,{"Set-Cookie": "gamesessionid="+session["id"],"content-type":"text/html","content-length":resHTML.length});		
			res.end(resHTML);
		}
	}
}
