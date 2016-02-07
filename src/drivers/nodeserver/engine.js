var express = require('express');
var async = require('async');

var app = express();

var fs = require('fs');

var phantom = require('phantom');
var ph;

var RESOURCE_TIMEOUT = 10000;

var port = process.argv[2];

var util = require('util');
var log_stdout = process.stdout;
var log_stderr = process.stderr;
var debug = true;

var access = fs.createWriteStream('./log/node.access-'+ port +'.log', { flags: 'a' }),
		error = fs.createWriteStream('./log/node.error-'+ port +'.log', { flags: 'a' });
console.log = function(d) {
	if(debug){
		access.write(util.format(d) + '\n');
		log_stdout.write(util.format(d) + '\n');
	}
};
console.error = function(d) {
	if(debug) {
		error.write(util.format(d) + '\n');
		log_stderr.write(util.format(d) + '\n');
	}
};

process.on('uncaughtException', function (err) {
	console.log('uncaughtException', err);
	errorHandling()
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
			task.res.send(data);

			//console.log(data);
		}else{
			task.res.send("error");
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
      console.log("exception", e);
    }
  });
});

app.get('/close', function (req, res) {
  closeAll(res);
});

function openURL(page, url, req, res, cb){
	var html, headers = {};
  page.open(url, function (status){
      if (status == "success") {

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
						//console.log(data);
						wappalyzer.detectAppsFromUrl(options, data, function(err, apps) {
							cb(err, apps);
						});
						page.close();

					});
				}catch(e){
					console.log('exception caugth', e);
					errorHandling();
				}


      }
      else{
        res.send('{status:"page load failed"}');
      }
  });

  //Callback when page resources are loaded and ready
	page.set('onResourceReceived', function(response) {
		//console.log('Resource Received');
		if ( response.url.replace(/\/$/, '') === url.replace(/\/$/, '') ) {
			if ( response.redirectURL ) {
				console.log('Redirecting...');
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
  res.send('Good bye from Phantom engine!\n');
  server.close();
}

function errorHandling(){
	 console.error("Internal error occured");
	 restartPhantom();
	 server.close();

	 server = app.listen(port, function () {
		console.log('Phantom engine restarted on port, ', port);
	 });
}

function restartPhantom(){
  ph.exit();

  phantom.create(function (phinstance) {
  ph = phinstance;
  if(!ph)
    console.error("Phantom recreation error.");
  else
    console.log('Phantom engine created again...\n');
  });
}

function pageInit(page){
	page.set('settings.loadImages', false);
	page.set('settings.resourceTimeout', RESOURCE_TIMEOUT);
	page.set('settings.userAgent', 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)');

	page.set('onConsoleMessage', function(message) {
		//console.log(message);
	});

	page.set('onError', function(message) {
		//console.log(message);
	});

	page.set('onResourceTimeout', function(message) {
		console.log('Resource timeout');
	});
}




