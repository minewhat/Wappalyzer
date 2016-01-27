var config = require("./config");
var wappalyzer = require(config.WAPPALYZER_PATH + "/index");

var options={
  url : "http://hylete.com",
  debug:true
}

wappalyzer.detectFromUrl(options,function  (err,apps,appInfo) {
  console.log(err,apps,appInfo);
})
