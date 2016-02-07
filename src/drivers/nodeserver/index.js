'use strict';

var fs = require('fs');
var path = require('path');


/**
 * This will take body & headers as input, then
 * run through detection.
 **/
exports.detectFromUrl = function (options, data, cb) {

	// ensure options and url were present
	if (!options || !options.url) {

		// send back a error ...
		cb(new Error("\"url\" is a required option to run"
		+ " wappalyzer and get the page content"))

	} else {
		//run actual detection
		runWappalyzer(options, data, cb);
	}
};


/**
 * This will take body & headers as input, then
 * run through detection.
 **/
exports.detectAppsFromUrl = function (options, data, cb) {

	// ensure options and url were present
	if (!options || !options.url) {

		// send back a error ...
		cb(new Error("\"url\" is a required option to run"
		+ " wappalyzer and get the page content"))

	} else {
		//run actual detection
		runWappalyzer(options, data, function(err, detectedApps, fullData){
			if(err || !detectedApps || fullData){
				cb(true, null);
			}

			console.log(fullData['appInfo']);
			var appInfo = fullData['appInfo'];
			for (var key in appInfo) {
				var obj = appInfo[key];
				var apps = [];
				if(obj && obj["confidenceTotal"] > 50)
				{
					apps.push(key);
				}
			}
			cb(err, apps);

		});
	}
};

function getAppsJson(cb) {
	// set the apps.json to testing stage
	var appsFileStr = path.resolve(__dirname, '../../apps.json');

	// read in the file
	fs.readFile(appsFileStr, 'utf8', function (err, data) {
		if (err) throw err;
		return cb(null, JSON.parse(data));
	});
}

function runWappalyzer(options, data, cb) {
	var debug = options.debug || false;

	var wappalyzer = null;
	wappalyzer = require('../../wappalyzer').wappalyzer;

	getAppsJson(function (err, apps) {
		var w = wappalyzer;
		w.driver = {
			log: function (args) {
				if (debug) {
					console.log(args.message);
				}
			},

			init: function () {
				w.categories = apps.categories;
				w.apps = apps.apps;
			},
			displayApps: function () {
				var app, url = Object.keys(w.detected)[0];
				var detectedApps = [];

				for (app in w.detected[url]) {
					detectedApps.push(app);

					if (debug) {
						console.log(app);
					}
				}
				cb(null, detectedApps, w.detected[url]);
			}
		};
		w.init();
		w.detected = [];
		w.analyze(options.hostname, options.url, data);
	});
}
