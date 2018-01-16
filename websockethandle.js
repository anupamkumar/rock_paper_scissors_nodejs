//this module handles websocket communication between peers. it's essentially websocket controller layer and implements the function calls by the websocket command router. Only used in multiplayer game scenerio

var mps = require('./multiplayersessionmanager');
var ris = require('./randomimageselect');

var module,logger;

exports.registerConnection = register;
exports.sendStatus = sendStatus;
exports.chat = chat;
exports.handleClosedConnections = handleClosedConnections;
exports.signalReady = signalReady;
exports.startRound = startRound;
exports.evaluateAnswer = evalAns;
exports.voteAnotherRound = voteAnotherRound;

exports.registerLogger = registerLogger;


//ready to log messages
function registerLogger(moduleName,loggerInstance) {
	loggerInstance.configLogger(moduleName);
	module = moduleName;
	logger = loggerInstance;
}

//players vote for another round depending on who voted, send vote to the other guy
function voteAnotherRound(vote) {
	var payload = {};
	mps.noteVote(vote['sessionid'],vote['un']);
	mps.getSession(vote['sessionid'],function (err,session) {
		if(err == null) {
			logger.logit(module,'info','voteAnotherRound()',vote['un']+" "+session['host-name']+" "+session['join-name']);
			if(vote['un'] == session['host-name']) {
				logger.logit(module,'info','voteAnotherRound()',"another round current votes:host="+session['host-voted']+" :join="+session['join-voted']);
				if(session['join-voted']) {	
					payload['type'] = 'anotherroundconfirmed';
					session['join-con'].sendUTF(JSON.stringify(payload));
					session['host-con'].sendUTF(JSON.stringify(payload));
					mps.resetVote();
				}
				else {
					payload['type'] = 'anotherroundvoteres';
					payload['whovoted'] = session['host-name'];
					session['join-con'].sendUTF(JSON.stringify(payload));
				}
			}			
			else if(vote['un'] == session['join-name']) {
				logger.logit(module,'info','voteAnotherRound()',"another round current votes:host="+session['host-voted']+" :join="+session['join-voted']);
				if(session['host-voted']) {
					payload['type'] = 'anotherroundconfirmed';
					session['join-con'].sendUTF(JSON.stringify(payload));
					session['host-con'].sendUTF(JSON.stringify(payload));
					mps.resetVote();
				}
				else {
					payload['type'] = 'anotherroundvoteres';
					payload['whovoted'] = session['join-name'];
					session['host-con'].sendUTF(JSON.stringify(payload));
				}
			}			
		}
	});
}

//evaluate each player's answer
function evalAns(answer) {
	mps.storeAnswer(answer['sessionid'],answer['un'],answer['answer'],answer['answerTS'],answer['dispTS'],function(error,result) {
		if(error == null) {
			var hostcon = result['host-con'];
			var joincon = result['join-con'];
			delete result['host-con'];
			delete result['join-con'];
			if(result['result'] == 'pending') {
				
			}
			else if(result['result'].indexOf("Fail") > -1) {
				result['type'] = 'postresultfail';
				hostcon.sendUTF(JSON.stringify(result));
				joincon.sendUTF(JSON.stringify(result));
			}
			else {
				result['type'] = 'postresultsuccess';
				hostcon.sendUTF(JSON.stringify(result));
				joincon.sendUTF(JSON.stringify(result));
			}
		}
		else {
			logger.logit(module,'info','evalAnswer()',"evalAns()::"+error);	
		}
	});
}

//player is ready... inform other guy and ack the player
function signalReady(signal) {
	mps.setReady(signal['sessionid'],signal['un'],function(con,othercon,who) {
		var payload = {
			'type':'readytoplay'		
		};
		ris(con.remoteAddress,function(imgJson) {			
			payload['rpsImgs'] = imgJson;
			if(who == 'host') 
				payload['status'] = 'host-ready';
			else 
				payload['status'] = 'join-ready';
			con.sendUTF(JSON.stringify(payload));
			payload['rpsImgs'] = null;
			othercon.sendUTF(JSON.stringify(payload));
		});		
	});
}
//confirm that new round will start to both players
function startRound(startroundMsg) {
	mps.getSession(startroundMsg['sessionid'],function(err,session) {
		if(err == null) {
			var payload = {
				'type':'startroundconfirm'
			};
			session['host-con'].sendUTF(JSON.stringify(payload));
			session['join-con'].sendUTF(JSON.stringify(payload));
		}
	});
}


//if peer disconnects ...
function handleClosedConnections(con) {
	mps.s(con,function(session,whodied,othercon) {
		if(whodied == "both") {
			mps.killMultiPlayerSession(session);
			logger.logit(module,'warn','handleClosedConnections()',session+" removed because both users connection was closed");
		}
		var payload = {
			'type':'disconnect',
			'whodied':whodied
		};
		if(othercon !=null)
			othercon.sendUTF(JSON.stringify(payload));
		mps.killMultiPlayerSession(session);
		logger.logit(module,'warn','handleClosedConnections()',session+" removed because "+whodied+" connection was closed");
	});
}



//if everyone has joined then send message other wise send message to sender than other guys has not joined
function chat(chatObj) {
	mps.getSession(chatObj['sessionid'],function(err,session) {
		if(session['host-con'] !=null && session['join-con'] != null) {
			var payload = {
				'type':'chatsuccess',
				'sayer': chatObj['un'],
				'sayermsg': chatObj['chatmsg'],
				'saytime': new Date()
			};
			session['host-con'].sendUTF(JSON.stringify(payload));
			session['join-con'].sendUTF(JSON.stringify(payload));
		}
		else {
			var payload = {
				'type':'chatfailure'
			};
			if(chatObj['un'] == session['host-name']) {
				session['host-con'].sendUTF(JSON.stringify(payload));
			}
			else {
				session['join-con'].sendUTF(JSON.stringify(payload));
			}
		}
	});
}

//send websocket connection status to all peers in the session
function sendStatus(sessionid) {
	mps.getSession(sessionid,function(err,session) {
		if(err == null) {
			var sendtohost = false,sendtojoin=false;
			var msg = {
			'type':'status',
			'host-player':session['host-name'],
			'join-player':session['join-name'],
			'host-status': 'not joined',
			'join-status': 'not joined'
			};
			if(session['host-con'] != null) {
				msg['host-status'] = "joined";
				sendtohost = true;
				
				logger.logit(module,'info','sendStatus()','SendStatus()::sending status message to host');
			}
			if(session['join-con'] != null) {
				msg['join-status'] = "joined";
				sendtojoin = true;
				
				logger.logit(module,'info','sendStatus()','SendStatus()::sending status message to join');
			}
			if(sendtohost)
				session['host-con'].sendUTF(JSON.stringify(msg));
			if(sendtojoin)
				session['join-con'].sendUTF(JSON.stringify(msg));
		}
	});
}

//register connection with session
function register(info,con,callback) {
	var jinfo = JSON.parse(info);
	logger.logit(module,'info','register()',"register()::info="+info);
	logger.logit(module,'info','register()',JSON.stringify(jinfo));
	mps.addWebSocketConnection(jinfo['sessionid'],jinfo['un'],con, function(stat) {
		callback(stat);
	});
}


