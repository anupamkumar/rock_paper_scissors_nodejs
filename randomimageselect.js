//Fetches a set of images from google image search API for terms rock paper scissor. 
//From the set of images returned by google image search, it selects 1 pair of R,P,S images each (one for player and other for opponent) at random
//returns the URL links as JSON message, which is forwarded to the clients to be rendered 


//TODO: Refactor and ADD logging 
var http = require('https');
module.exports = function(userip,callback) {
	console.log(userip);
	var url = "/ajax/services/search/images?v=1.0&rsz=8&safe=off&userip="+userip;
	var queryForRock = "&q=rock";
	var queryForPaper = "&q=paper";
	var queryForSissor = "&q=sissor";
	var rock= [],paper=[],sissor=[];
	var randomStartValue = "&start="+randomWithMultiple(8,57);
	var ready = false;
	var jsonResult = {};
	
	getJSONResponse(setRequestOptions(url+queryForRock+randomStartValue),"rock");
	getJSONResponse(setRequestOptions(url+queryForPaper+randomStartValue),"paper");
	getJSONResponse(setRequestOptions(url+queryForSissor+randomStartValue),"sissor");
	
	//check if all three image search results are completed and we are ready to callback with complete data
	var check = function() {
		console.log("running check ... checking if ready...ready="+ready);
		if(ready) {
			jsonResult["rockImg"] = rock;
			jsonResult["paperImg"] = paper;
			jsonResult["sissorImg"] = sissor;
			console.log("about to make callback");
			callback(jsonResult);
		}
		else 
			setTimeout(check, 1000);
	}
	check();

	//prepare to request google image search
	function setRequestOptions(reqURLPath) {
		var options = {
			host : "ajax.googleapis.com",
			referer : 'localhost:8000',
			port: 443,
			path: reqURLPath
		};
		return options;
	}

	//get response for rock, paper, scissor async once all three async calls are complete ready will be set to true 
	//and callback with JSON result will be made
	function getJSONResponse(options,varname) {
		var temp = "";
		http.get(options, processRes);

		//handling everything myself, not using any middleware
		function processRes(res) {
			res.on('data',collect);
			res.on('error',reportError);
			res.on('end',returnRes);
		}
		//data coming in append to temp variable
		function collect(buf) {
			temp = temp + buf.toString();
		}
		//data has all come in connection is closed now select random images from the JSON google sent
		function returnRes() {
			selectRandomImages();
		}
		//something went wrong...throw error TODO:log this 
		function reportError(error) {
			throw error;
		}
		//select random rock paper scissor images
		function selectRandomImages() {
			var jsonElement = JSON.parse(temp);
			try {
				var results = jsonElement["responseData"]["results"];
				var rnos = [];
				while(rnos.length < 2) { 
					var rno = Math.floor(Math.random()*results.length);
					while(isBadDomain(results[rno].unescapedUrl)) 
						rno = Math.floor(Math.random()*results.length);
					rnos.push(rno);
				}
				if(varname=="rock") {
					rock.push(results[rnos[0]].unescapedUrl);
					rock.push(results[rnos[1]].unescapedUrl);
					checkIfReady();
				}
				else if(varname == "paper") {			
					paper.push(results[rnos[0]].unescapedUrl);
					paper.push(results[rnos[1]].unescapedUrl);
					checkIfReady();
				}
				else if(varname == "sissor") {
					sissor.push(results[rnos[0]].unescapedUrl);
					sissor.push(results[rnos[1]].unescapedUrl);
					checkIfReady();
				}
			}
			catch(e) {
				console.log("fuck! "+e);
				ready = true;
			}
		}
		//ready = true only when random rock, paper,scissor images are fetched
		function checkIfReady() {
			if(rock != null && paper != null && sissor != null) 
				ready = true;
		}

		//these domains don't allow hotlinking, avoid results from them
		function isBadDomain(tgt) {
			var badDomain = ["public-domain-image.com","pixabay.com"];
			var flag = false;
			badDomain.forEach(function(element,index,array) {
					if(tgt.indexOf(element) > -1) {
					flag = true;
					}
			});
			return flag;
		}
	}
	//generates random numbers that are multiples of num that are lesser than limit. 
	//basically set the offset of the google result set 
	//(i.e for eg, if value is 32, we will get google image results from 4th page, only slightly relevant and more random looking result set)
	function randomWithMultiple(num,limit) {
		var no = Number(num);
		var rno = Math.floor(Math.random()*limit);
		while(rno%no != 0) 
			rno = Math.floor(Math.random()*limit);
		return rno;
	}
}
