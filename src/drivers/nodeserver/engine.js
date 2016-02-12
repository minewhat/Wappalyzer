var express = require('express');
var async = require('async');

var app = express();

var fs = require('fs');

var phantom = require('phantom');
var ph;

var RESOURCE_TIMEOUT = 15000;

var port = process.argv[2];

var util = require('util');
var debug = true;

process.on('uncaughtException', function (err) {
	console.error('uncaughtException', err);
	closeAll();
});

if(!port)
  console.error("Port not given");
var server = app.listen(port, function () {
  console.log('Phantom engine listening on port, ', port);
});


var N_SIMULTANEOUS = 1;
var q = async.queue(function (task, next) {
	openURL(task.page, task.url, task.req, task.res, function(err, data){
		if(!err){
			task.res.json(data);
		}else{
			var serverError = {status:"error"}
			task.res.json(serverError);
			console.log("Wappalyzer API failed.");
		}
		next();
	});
}, N_SIMULTANEOUS);

q.drain = function() {
	console.log('\nQueue empty.\n');
};

phantom.create(function (phinstance) {
  ph = phinstance;
  if(!ph)
    console.error("Phantom creation error");
  else{
    console.log('Phantom engine started...\n');
  }
});

app.get('/', function (req, res) {
  res.send('I am Phantom engine speaking!\n');
});

app.get('/processurl', function (req, res) {
  ph.createPage(function (page) {
    var url = req.query.url;
    if(!url)
      console.error("URL missing!!");

    try{
      pageInit(page);
			var task = { page:page, url: url, req: req, res: res };
			q.push(task);
    }catch(e){
      console.log("page exception", e);
    }
  });
});

app.get('/close', function (req, res) {
  closeAll(res);
});

function openURL(page, url, req, res, cb){
	var html, headers = {};
  page.open(url, function (status){
		  //if (status == "success") {

			  //Include the Wappalyzer custom code
				var wappalyzer = require("./index");

				try {
					var options={
						url : url,
						debug:false
					};

					async.parallel({
						html: function(callback) {
							page.get('content', function(data){
								var h = data;
								if ( h.length > 50000 ) {
									h = h.substring(0, 25000) + h.substring(h.length - 25000, h.length);
								}
								callback(null, h);
							});
						},
						env: function(callback) {
							page.evaluate(function () {
								var i, environmentVars = '';
								for (i in window) {
									environmentVars += i + ' ';
								}
								return environmentVars;
							}, function (env) {
								env = env.split(' ').slice(0, 1500);
								callback(null, env);
							});
						},
						headers: function(callback){
							callback(null, headers);
						}
					}, function(err, results) {
						//results is now equals to: {html:'', env:'', headers:''}
						var data = results;
						wappalyzer.detectAppsFromUrl(options, data, function(err, apps) {
							cb(err, apps);
						});
						page.close();
					});
				}catch(e){
					console.log('exception caugth', e);
					closeAll();
				}
  });

  //Callback when page resources are loaded and ready
	page.set('onResourceReceived', function(response) {
		//console.log('Resource Received');
		if ( response.url.replace(/\/$/, '') === url.replace(/\/$/, '') ) {
			if ( response.redirectURL ) {
				console.log('Redirecting to ', response.redirectURL ,'...');
				url = response.redirectURL;
				return;
			}

			if (response.stage === 'end' && response.status === 200) {
					response.headers.forEach(function(header) {
					headers[header.name.toLowerCase()] = header.value;
				});
			}
		}
	});
}

function closeAll(res){
  ph.exit();
  server.close();
	//res.send('Good bye from Phantom engine!\n');
}

function pageInit(page){
	page.set('settings.loadImages', false);
	page.set('settings.webSecurityEnabled', false);
	page.set('settings.ssl-protocol', 'any');
	page.set('settings.resourceTimeout', RESOURCE_TIMEOUT);
	page.set('settings.userAgent', 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)');

	//page.set('onConsoleMessage', function(message) {
	//	//console.log(message);
	//});
  //
	//page.set('onError', function(message) {
	//	//console.log(message);
	//});
  //
	page.set('onResourceTimeout', function(message) {
		console.log('Resource timeout');
	});

	page.onResourceRequested = function (request) {
		console.error('= onResourceRequested()');
		console.error('  request: ' + JSON.stringify(request, undefined, 4));
	};

	page.onResourceReceived = function(response) {
		console.error('= onResourceReceived()' );
		console.error('  id: ' + response.id + ', stage: "' + response.stage + '", response: ' + JSON.stringify(response));
	};

	page.onLoadStarted = function() {
		console.error('= onLoadStarted()');
		var currentUrl = page.evaluate(function() {
			return window.location.href;
		});
		console.error('  leaving url: ' + currentUrl);
	};

	page.onLoadFinished = function(status) {
		console.error('= onLoadFinished()');
		console.error('  status: ' + status);
	};

	page.onNavigationRequested = function(url, type, willNavigate, main) {
		console.error('= onNavigationRequested');
		console.error('  destination_url: ' + url);
		console.error('  type (cause): ' + type);
		console.error('  will navigate: ' + willNavigate);
		console.error('  from page\'s main frame: ' + main);
	};

	page.onResourceError = function(resourceError) {
		console.error('= onResourceError()');
		console.error('  - unable to load url: "' + resourceError.url + '"');
		console.error('  - error code: ' + resourceError.errorCode + ', description: ' + resourceError.errorString );
	};

	page.onError = function(msg, trace) {
		console.error('= onError()');
		var msgStack = ['  ERROR: ' + msg];
		if (trace) {
			msgStack.push('  TRACE:');
			trace.forEach(function(t) {
				msgStack.push('    -> ' + t.file + ': ' + t.line + (t.function ? ' (in function "' + t.function + '")' : ''));
			});
		}
		console.error(msgStack.join('\n'));
	};
}


//function errorHandling(){
//	console.error("Internal error occurred.");
//	restartPhantom();
//	server.close();
//
//	server = app.listen(port, function () {
//		console.log('Phantom engine restarted on port, ', port);
//	});
//}
//
//function restartPhantom(){
//	if(ph)
//		ph.exit();
//
//	phantom.create(function (phinstance) {
//		ph = phinstance;
//		if(!ph)
//			console.error("Phantom recreation error.");
//		else
//			console.log('Phantom engine created again...\n');
//	});
//}


