//Implementation of simplistic version of Restricted Boltzmann machine for RPS

//Info about algorithm - 
// -- http://www.dllu.net/programming/rps/
// -- Full paper -- http://www.enterrasolutions.com/media/docs/2013/08/cogscibm.pdf
// NOTE:: Each user's profile history is maintained in redis across sessions. So if you play today and play tomorrow with the same name, expect to loose a lot as time progresses because the system will predict what you will likely choose based on your profile.

exports.connectRedis = connect;
exports.checkConnection = chk;
exports.registerFeedBack = regFB;
exports.getBestChoice = getBestChoice;

var redis;

var connected = false;

//connect to redis
function connect() { 
	if(!connected) {
		//Redis - to - go -setup heroku
		if (process.env.REDISTOGO_URL) {
			var rtg   = require("url").parse(process.env.REDISTOGO_URL);
			redis = require("redis").createClient(rtg.port, rtg.hostname);
			redis.auth(rtg.auth.split(":")[1]);
		} else {
			//normal Redis on local node dev server
			redis = require("redis").createClient();
		}
		
	}
}

// redis.on('ready', function() {
// 	connected = true;
// });

// redis.on('end', function() {
// 	connected = false;
// });

// redis.on('error', function() {
// 	connected = false;
// });

//check connection status
function chk() {
	return 0;
	// return connected;
}


//compute the best choice based on user's past choices
function getBestChoice(username,userage,callback) {
	var rn =  Math.random()*3;
	var output="rock";
	if(rn < 1)
		output = "paper";
	else if(rn > 1 && rn < 2)
		output = "sissor";
	else
		output = "rock";
	callback(output);
	// return 0;
	// var rr=0,pr=0,sr=0;
	// redis.hgetall(username+userage, function(err, reply) {
	// 	if(reply != null) {			
	// 		rr = reply['rScore']; 
	// 		pr = reply['pScore'];
	// 		sr = reply['sScore'];			
 //    	}
 //    	//expected entropy of system compared to past, see in which dimension the entropy would increase the most
 //    	var randNum = Math.random()*(Math.exp(rr)+Math.exp(sr)+Math.exp(pr));
	// 	var output;
	// 	if (randNum < Math.exp(rr))
	// 		output = "rock"
	// 	else if (randNum < Math.exp(rr) + Math.exp(pr))
	// 		output = "paper"
	// 	else {
	// 		output = "sissor"
	// 	}
	// 	callback(output);
	// });
	
}
//register user's input and set for encouraging/discourging change in entropy for the next draw.
function regFB(username,userage,userInput) {
	return 0;
	// var rr=0,sr=0,pr=0,playcount=0;
	// redis.hgetall(username+userage, function(err, reply) {
	// 	if(reply != null) {
	// 		playcount = reply['playcount'];
 //    		rr = reply['rScore']; 
 //    		pr = reply['pScore'];
 //    		sr = reply['sScore'];    		
 //    	}
 //    	playcount++;
	// 	rr *= 0.95;
	// 	sr *= 0.95;
	// 	pr *= 0.95;
	// 	switch(userInput) {
	// 		case 'rock':
	// 			pr += 0.1;
	// 			sr -= 0.1;
	// 			break;
	// 		case 'paper':
	// 			sr += 0.1;
	// 			rr -= 0.1;
	// 			break;
	// 		case 'scissor':
	// 			rr += 0.1;
	// 			pr -= 0.1;
	// 			break;
	// 	}	
	// 	redis.hmset(username+userage,{
	// 		'playcount':playcount,
	// 		'rScore':rr,
	// 		'pScore':sr,
	// 		'sScore':pr
	// 	});
	// });	
}
