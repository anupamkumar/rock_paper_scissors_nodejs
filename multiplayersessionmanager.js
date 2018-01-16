//implements handling of "session / game session object", which is the model that stores all variables required to run a multiplayer session. line no- 235 shows the attributes the model stores. also this module stores a collection of multiplayer session objects.

var uuid = require('node-uuid');
var module,logger;
var msessions = []

//exports from this module
exports.createMultiPlayerSession = createMultiPlayerSession;
exports.joinMultiPlayerSession = joinMultiPlayerSession;
exports.killMultiPlayerSession = deleteMultiPlayerSession;
exports.isValidmSession = isValidmSession;
exports.isValidmSessionVerify = isValidmSessionVerify;
exports.iswebSocketReady = iswebSocketReady;
exports.setWebSocketReady = setWebSocketReady;
exports.setWebSocketUnReady = setWebSocketUnReady;
exports.addWebSocketConnection = addWebSocketConnection;
exports.getSession = getSession;
exports.s = searchByConnectionObj;
exports.setReady = setReady;
exports.storeAnswer = storeAnswer;
exports.noteVote = noteVote;
exports.resetVote = resetVote;
exports.registerLogger = registerLogger;

//register logger, now read to log messages
function registerLogger(moduleName,loggerInstance) {
	loggerInstance.configLogger(moduleName);	
	module = moduleName;
	logger = loggerInstance;
}

//resetting voted variable at the end of each round for each player
function resetVote(msessionid) {
	searchBymSessionId(msessionid, function(idx) {
		if(idx > -1) {
			msessions[idx]['host-voted'] = false;
			msessions[idx]['join-voted'] = false;
		}
	});
}

//note who voted to play another round 
function noteVote(msessionid,musername) {
	searchBymSessionId(msessionid, function(idx) {
		if(idx > -1) {
			if(msessions[idx]['host-name'] == musername) {
				msessions[idx]['host-voted'] = true;
				logger.logit(module,'info',"NoteVote()","host-vote registered::"+msessions[idx]['host-voted']);
			}
			else {
				msessions[idx]['join-voted'] = true;
				logger.logit(module,'info',"NoteVote()"," join-vote registered::"+msessions[idx]['join-voted']);
			}
		}
	});
}

//update session variable to show who has selected what answerTS == answertimestamp, choiceDispTS == the timestamp when the choices were displayed
function storeAnswer(msessionid, musername, answer, answerTS, choiceDispTS, callback) {
	searchBymSessionId(msessionid, function(idx) {
		if(idx > -1) {
			if(msessions[idx]['host-name'] == musername) {
				msessions[idx]['host-ans'] = answer;
				msessions[idx]['host-ansTS'] = answerTS;
				msessions[idx]['host-chDispTS'] = choiceDispTS;
			}
			else if(msessions[idx]['join-name'] == musername) {
				msessions[idx]['join-ans'] = answer;
				msessions[idx]['join-ansTS'] = answerTS;
				msessions[idx]['join-chDispTS'] = choiceDispTS;
			}
			if(msessions[idx]['host-ans'] != null && msessions[idx]['join-ans'] !=null) {
				var result = evalAnswers(idx);
				callback(null,result);
			}
			else {
				var result = {};
				result['result'] = "pending";
				callback(null,result);
			}
		}
		else {
			callback("Invalid session",null);
		}
	});
}

//evaluate the two players answer and determine winner 
//only evaluate and declare a winner if both players responses was recieved to server within 10 secs of each other and if players responded within 10 secs of seeing the options
function evalAnswers(idx) {
	var result = {};
	result['host-con'] = msessions[idx]['host-con'];
	result['join-con'] = msessions[idx]['join-con'];
	var hostReactionTime = msessions[idx]['host-ansTS'] - msessions[idx]['host-chDispTS'];
	var joinReactionTime = msessions[idx]['join-ansTS'] - msessions[idx]['join-chDispTS'];
	var playerDisplayWindow = Math.abs(msessions[idx]['host-chDispTS'] - msessions[idx]['join-chDispTS']);
	logger.logit(module,'info',"evalanswers()","hostreactiontime="+hostReactionTime+"::joinReactionTime"+joinReactionTime+"::playerDisplayWindow="+playerDisplayWindow+"pdwc="+eval(playerDisplayWindow > 10000));
	
	if(playerDisplayWindow > 10000) {
		result['result'] = 'Fail:System Delay';		
	}
	else {
		if(hostReactionTime > 35000) {
			result['result'] = 'Fail:'+msessions[idx]['host-name']+' too late';
		}
		if(joinReactionTime > 35000) {
			result['result'] = 'Fail:'+msessions[idx]['join-name']+' too late';
		}
		if(joinReactionTime > 3500 && hostReactionTime > 3500) {
			result['result'] = 'Fail:Both players too late';
		}
	}
	if(result['result'] != null) {		
		return result;
	}
	else {
		if(msessions[idx]['host-ans'] == msessions[idx]['join-ans']) {
			result['result'] = "draw";
			result['host-score'] = msessions[idx]['host-score'];
			result['join-score'] = msessions[idx]['join-score'];		
		}
		else if((msessions[idx]['host-ans'] == "paper" && msessions[idx]['join-ans'] == "rock") 
		|| (msessions[idx]['host-ans'] == "sissor" && msessions[idx]['join-ans'] == "paper")
		|| (msessions[idx]['host-ans'] == "rock" && msessions[idx]['join-ans'] == "sissor")) {
			result['result'] = "host wins";
			msessions[idx]['host-score'] = msessions[idx]['host-score']+1;
			result['host-score'] =  msessions[idx]['host-score'];
			result['join-score'] = msessions[idx]['join-score'];
		}
		else if((msessions[idx]['host-ans'] == "rock" && msessions[idx]['join-ans'] == "paper") 
		|| (msessions[idx]['host-ans'] == "paper" && msessions[idx]['join-ans'] == "sissor")
		|| (msessions[idx]['host-ans'] == "sissor" && msessions[idx]['join-ans'] == "rock")) {
		 	result['result'] = "join wins";
		 	result['host-score'] = msessions[idx]['host-score'];
			msessions[idx]['join-score'] = msessions[idx]['join-score']+1;	
			result['join-score'] = msessions[idx]['join-score'];
		 }
		 result['host-ans'] = msessions[idx]['host-ans'];
		 result['join-ans'] = msessions[idx]['join-ans'];
		 return result;
	}
}

//get ready of a new round
function setReady(msessionid, musername, callback) {
	searchBymSessionId(msessionid, function(idx) {
		if(idx > -1) {
			msessions[idx]['host-ans']=null;
			msessions[idx]['host-ansTS']=null;
			msessions[idx]['host-chDispTS']=null;
			msessions[idx]['join-ans']=null;
			msessions[idx]['join-ansTS']=null;
			msessions[idx]['join-chDispTS']=null;
			msessions[idx]['host-voted']=false;
			msessions[idx]['join-voted']=false;
			if(msessions[idx]['host-name'] == musername) {
				callback(msessions[idx]['host-con'],msessions[idx]['join-con'],"host");
			}
			else {
				callback(msessions[idx]['join-con'],msessions[idx]['host-con'],"join");
			}
		}
	});
}

//search for a session // utility function O(N) implementation, TODO: change to O(log(N)) it's easy, just use named keys and let JS find the key instead of searching and finding indices like a NOOB
function getSession(msessionid, callback) {
	searchBymSessionId(msessionid, function(idx) {
		if(idx > -1) {
			callback(null,msessions[idx]);
		}
		else {
			callback("invalid session",msessions[idx]);
		}
	});
}
//O(N) implementation for searching session array by connection object, it is used to detect and notify the other user immediately if one of the two users got disconnect or left 
function searchByConnectionObj(con,callback) {
	msessions.forEach(function(e,i,a) {
		if(e['host-con'] == con) {
			if(e['join-con'] !=null) {
				callback(e['msessionid'],e['host-name'],e['join-con']);
			}
			else {
				callback(e['msessionid'],"both",null);
			}
		}		
		else if(e['join-con'] == con) {
			if(e['host-con'] !=null) {
				callback(e['msessionid'],e['join-name'],e['host-con']);
			}
			else {
				callback(e['msessionid'],"both",null);
			}
		}
	});
}

//save connection details to be used by the searchByConnectionObj function TODO: need to figure out something small to save, perhaps hash of the connection object instead ?
function addWebSocketConnection(msessionid, u,con, callback) {
	var stat = false;
	searchBymSessionId(msessionid, function(idx) {
		logger.logit(module,'info',"addWebSocketConnection()","msessionid="+msessionid+"::idx="+idx);
		if(idx > -1) {
			if(msessions[idx]['host-name'] == u) {
				msessions[idx]['host-con'] = con;
				stat = true;
			}
			else if(msessions[idx]['join-name'] == u) {
				msessions[idx]['join-con'] = con; 
				stat = true;
			}
			else 
				stat = false;
		}		
		callback(stat);
	});
}

//check if session is valid and meant for the user or not... do this before actually allowing the user to join a game and upgrade protocol to WebSockets
function isValidmSessionVerify(msessionid, msessionu, callback) {
	var stat = false;	
	searchBymSessionId(msessionid, function(idx) {
		if(idx > -1) {			
			hn = msessions[idx]['host-name'];
			jn = msessions[idx]['join-name'];
			if(msessionu == hn || msessionu == jn) {
				stat = true;
			}
		}
	});
	callback(stat);
}

//create new session, gets called when someone hosts a multiplaer game
function createMultiPlayerSession(hostname,hostage,hostemail) {
	var msession = {
		"host-name":hostname,
		"join-name":'???',
		"host-age":hostage,
		"host-email":hostemail,
		"host-con":null,		
		"game-code": genGameCode(),
		"msessionid": uuid.v1()
	};
	msessions.push(msession);
	return msession;	
}

//self explanatory... delete a session when either one of the user leaves
function deleteMultiPlayerSession(msessionid) {
	var error = "No such session to delete";
	var stat = false;
	searchBymSessionId(msessionid, function(idx) {
		if(idx > -1) {
			msessions.splice(idx,1);
			error = null;
			stat = true;
		}
	});
	
}

//check if websocket connection is ready for communication 
function iswebSocketReady(msessionid,callback) {
	var stat=false;
	searchBymSessionId(msessionid, function(idx) {
		if(idx > -1) {
			stat = msessions[idx]['socketReady']; 
		}
		callback(stat);
	});
}

//set
function setWebSocketReady(msessionid) {
	
	searchBymSessionId(msessionid, function(idx) {
		if(idx > -1) {
			msessions[idx]['socketReady'] = true;			
		}
	});
}

//unset
function setWebSocketUnReady(msessionid) {
	searchBymSessionId(msessionid, function(idx) {
		if(idx > -1) {
			msessions[idx]['socketReady'] = false;
		}
	});
}

//add joined users details to the msession obj
function joinMultiPlayerSession(joinname,joinage,joinemail,gamecode,callback) {
	logger.logit(module,'info',"joinMultiPlayerSession()",":: ip params "+joinname+" "+joinage+" "+joinemail+" "+gamecode);
	var msessionid;
	searchByGameCode(gamecode,function(idx) {
		logger.logit(module,'info',"joinMultiPlayerSession()","::idx"+idx);
		if(idx > -1) { 
			msessions[idx]['game-code'] = '';
			msessions[idx]['join-name'] = joinname;
			msessions[idx]['join-age'] = joinage;
			msessions[idx]['join-email'] = joinemail;
			msessions[idx]['join-con'] = null;
			msessions[idx]['host-score'] = 0;
			msessions[idx]['join-score'] = 0;
			msessionid = msessions[idx]['msessionid'];
			callback(null,msessionid);
		}
		else {
			callback("Invalid Session",null);
		}
	});
}

//see if session exists
function isValidmSession(msessionid,callback) {
	var status=false;
	searchBymSessionId(msessionid, function(idx) {
		if(idx > -1) {
			status = true;
		}
		callback(status);
	});	
}

//O(N) impl of session search by sessionid TODO:make O(log(N))
function searchBymSessionId(msessionid,callback) {
	var idx = -1;
	msessions.forEach(function(e,i,a) {
		if(e['msessionid'] == msessionid)
			idx = i;
	});
	callback(idx);
}


//O(N) impl of session search by gamecode ... used to figure who joins what session TODO: make O(log(N))
function searchByGameCode(gamecode,callback) {
	var idx = -1;
	msessions.forEach(function(e,i,a) {
		if(e['game-code'] == gamecode) 
			idx = i;
	});
	callback(idx);
}

//Generate game room code ... util function
function genGameCode() {
	return Math.floor(Math.random()*999999);
}
