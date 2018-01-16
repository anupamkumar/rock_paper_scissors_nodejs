//implements module level logger. i.e httpserverhandle module has it's own logger, sessionmanger module has it's own logger

var log4js = require('log4js');

var moduleLoggers = {};

exports.configLogger = configLogger;
exports.logit = logit;

//init a logger for a particular module. take the module name as parameter and create two log appenders to append all log and one for exclusively errors and above
function configLogger(module) {
	var errorModule = 'error-'+module;
	var allModule = 'all-'+module;
	log4js.loadAppender('file');
	log4js.addAppender(log4js.appenders.file('logs/all-'+module+'.log'), allModule);
	log4js.addAppender(log4js.appenders.file('logs/error-'+module+'.log'), errorModule);
	var errorlogger = log4js.getLogger(errorModule);
	var alllogger = log4js.getLogger(allModule);
	errorlogger.setLevel('INFO');
	alllogger.setLevel('ERROR');
	moduleLoggers[module] = {};
	moduleLoggers[module]['em'] = errorlogger;
	moduleLoggers[module]['am'] = alllogger;
}
//take the module, function, level (info to fatal) and message and tell the appropriate logger to log it 
function logit(module,level,method,message) {
	console.log(module+" "+level+" "+method+" "+message);
	switch(level) {
		case 'info':
			moduleLoggers[module]['am'].info("in method "+method+":"+message);
			break;
		case 'warn':
			moduleLoggers[module]['am'].warn("in method "+method+":"+message);
			break;
		case 'error':
			moduleLoggers[module]['am'].error("in method "+method+":"+message);
			moduleLoggers[module]['em'].error("in method "+method+":"+message);
			break;
		case 'fatal':
			moduleLoggers[module]['am'].fatal("in method "+method+":"+message);
			moduleLoggers[module]['em'].fatal("in method "+method+":"+message);
			break;
	}
}




