//implements the model and required methods to work with the model to smoothly run and track single player games. line 62 shows the attributes that model attributes. stores a collection of session objects/game session objects

var sessions = [];
var uuid = require('node-uuid');
var crypto = require('crypto');
var fs = require('fs');
var module,logger;

exports.createSinglePlayerSession = createSinglePlayerSession;
exports.getUserDetails = getUserDetails;
exports.addSession = addSession;
exports.checkIfSessionIsValid = check;
exports.addServedFile = addServedFile;
exports.checkServedFile = checkServedFile;
exports.sessiongc = runSessionGC;
exports.etagSig = sha1FileSig;
exports.setScore = setScore;
exports.registerLogger = registerLogger;

//ready to log stuff in this module now
function registerLogger(moduleName,loggerInstance) {
	loggerInstance.configLogger(moduleName);	
	module = moduleName;
	logger = loggerInstance;
}

//save score in session object, register the userInput against the algorithm, (feedback)
function setScore(userInput,result,hideTable,sessionid, alg, callback) {
	search(sessionid,function(idx) {
		if(idx > -1) { 
			if(hideTable !=null)
				sessions[idx]['hideTable'] = hideTable;
			if(result=='win') 
				sessions[idx]['userscore'] = Number(sessions[idx]['userscore']) + 1;
			else if(result == 'loose')
				sessions[idx]['aiscore'] = Number(sessions[idx]['aiscore']) + 1;
			alg.registerFeedBack(sessions[idx]['username'],sessions[idx]['userage'],userInput);
			var jsonRes = {};
			jsonRes['pscore'] = sessions[idx]['userscore'];
			jsonRes['cscore'] = sessions[idx]['aiscore'];
			jsonRes['hideTable'] = sessions[idx]['hideTable'];
			callback(jsonRes);
		}
	});
}

//generate sha1 for static assests, use it to compare if changes are made to static assets
function sha1FileSig(file,callback) {
	var algo = 'sha1';
	var sha;
	var shasum = crypto.createHash(algo);
	var fstream = fs.ReadStream(file);
	fstream.on('data',function(d) { shasum.update(d); });
	fstream.on('end',function(d) { sha = shasum.digest('hex'); 
		callback(sha);
	});
}

//create a new single player session ... gets invoked when user hosts a game
function createSinglePlayerSession(username,age) {
	var session = {};
	session["username"] = username;
	session["userage"] = age;
	session["id"] = uuid.v1();
	session["creationtime"] = new Date();
	session["updatedtime"] = null;
	session["otherdata"] = [];		
	session["servedfiles"] = [];
	session["userscore"]=0;
	session["aiscore"]=0;
	session["hideTable"]=false;
	return session;
}

//update session timestamp. will be used by session garbage collector. 
function updateSessionTS(idx) {	
	sessions[idx]["updatedtime"] = new Date();	
}

//Basically, since HTTP is stateless, I would not know if the user has closed the window and stopped playing or not, especially Since I am making any polling. So, the the sessiongc will remove session from the session collection if it sees that it's been inactive for more than 5 mins
var sessiongc = function() {
	sessions.forEach(function(e,i,a) {		
		if(new Date() - new Date(e["updatedtime"]) > 5*60*1000) {			
			sessions.splice(i,1);
		}
	});
	setTimeout(sessiongc, 60000);
}
//caller hook
function runSessionGC() {
	sessiongc();
}

//Add a created session TODO: combine createSinglePlayerSession and this
function addSession(session) {	
	session["updatedtime"] = new Date();	
	sessions.push(session);
}

//used by sessiongc ??
function check(sessionid) {
	var res = false;
	search(sessionid, function(idx) {		
		res = idx > -1;		
		if(res)
			updateSessionTS(idx);	
	});	
	return res;
}


//O(N) implemenation of searching session objects. by sessionid TODO:don't store collection as array, store it as a dict/map so that there will not be need to do O(N) search and search will use inbuilt O(Log(N))
function search(sessionid,callback) {
	idx = -1;
	sessions.forEach(function(e,i,a) {
		if(e["id"] == sessionid) {
			idx = i;			
			return;
		}
	});
	callback(idx);
}

//note that a static file is already served to the user and check against it TODO: store sha1 of filename, not the filename itself
function addServedFile(sessionid,file) {
	search(sessionid,function(idx) {
		if(idx > -1) {
			sessions[idx]["servedfiles"].push(file);
			updateSessionTS(idx);
		}
		else
			throw "No session to serve";
	});
}

//retrive username and userage of player from session model
function getUserDetails(sessionid,callback) {
	search(sessionid,function(idx) {
		if(idx > -1) {
			callback(sessions[idx]['username'],sessions[idx]['userage']);
		}
	});
}

//check if file is served, if it is already served then a positive number will be returned
function checkServedFile(sessionid,file,callback) {
	var result = false;
	var error = "No session to serve";
	search(sessionid,function(idx) {
		if(idx > -1) {
			result = sessions[idx]["servedfiles"].indexOf(file) > -1;
			updateSessionTS(idx);
			callback(null,result);
		}
		else 
			callback(error,null);
	});
}

