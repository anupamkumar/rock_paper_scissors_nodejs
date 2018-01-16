var uuid = require('node-uuid');

	function create(username,age) {
		var session = {};
		session["username"] = username;
		session["userage"] = age;
		session["id"] = uuid.v1();
		session["creationtime"] = new Date();
		session["updatedtime"] = null;
		session["otherdata"] = [];		
		return session;
	}

