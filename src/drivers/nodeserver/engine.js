var express = require('express');
var async = require('async');

var app = express();

var fs = require('fs');

var phantom = require('phantom');
var ph;

var RESOURCE_TIMEOUT = 9000;

var port = process.argv[2];
if(!port)
  console.error("Port not given");
var server = app.listen(port, function () {
  console.log('Phantom engine listening on port, ', port);
});

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
      openURL(page, url, req, res);
    }catch(e){
      console.log("exception", e);
    }
  });
});

app.get('/close', function (req, res) {
  closeAll(res);
});

function openURL(page, url, req, res){
	var html, headers = {};
  page.open(url, function (status){
      if (status == "success") {

				var config = require("./config");
				var wappalyzer = require(config.WAPPALYZER_PATH + "/wapp");

				var options={
					url : url,
					debug:true
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
					  //results is now equals to: {html:'', env:''}
						var data = results;
					  //console.log(data);
						wappalyzer.detectFromUrl(options, data, function(err, apps, appInfo) {
							console.log(err, apps, appInfo);
						});
						page.close();
				});

      }
      else{
        res.send('Page load failed');
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

			if ( response.stage === 'end' && response.status === 200 && response.contentType.indexOf('text/html') !== -1 ) {
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
   restartPhantom();
   console.error("Internal problem occured");
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





