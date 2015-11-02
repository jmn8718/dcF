var express = require('express');
var router = express.Router();

var raml = require('raml-parser');
var raml2html = require('raml2html');
var url = require('url');
var fs = require('fs');

function toFile(file, content){
  if(fs.existsSync(file)){
    fs.unlinkSync(file);
    console.log('deleted file: ',file);
  } else {
    console.log('file dont exist: ',file);
  }
  fs.writeFile(file, content, function(err) {
    if(err)
      console.error("Error", err);
    else
      console.log("output file", file, "was created!");
  });
}

function sendError(res, errorCode){
  var data = {};
  if(errorCode==401)
    data = {
      error: 401,
      description: 'Requiered params not found'
    }
  else if(errorCode==404)
    data = {
      error: 404,
      description: 'RAML file not found'
    }
  else
    data = {
      error: 404,
      description: 'Unexpected error'
    }
  res.send(data);
}

function generateAnchor(base, element){
  return base + "_" +element.replace("/","");
}
function generateIndex(data){
  index = {};

  console.log('..........')
  for(var resourceL1 in data['resources']){
    console.log(data['resources'][resourceL1])
    console.log('+++++++')
    if(data['resources'][resourceL1].methods!=undefined){
      console.log(data['resources'][resourceL1].methods)
      for(var method in data['resources'][resourceL1].methods)
        console.log('---------------------',data['resources'][resourceL1].methods[method].method)
    }else
      console.log('no tengo naaa')
    console.log('XXXXX')
  }
  console.log('+++++++')

  return index;
}
/* GET ramlOperations listing. */
router.get('/', function(req, res, next) {
  var uriParts = url.parse(req.url, true, true);
  if(uriParts.query.raml==undefined || uriParts.query.template==undefined)
    sendError(res,401);
  else if(uriParts.query.raml.length<=0 || uriParts.query.raml.indexOf(".raml")<=0 )
    sendError(res,404);
  else{
    var indexOfExtension = uriParts.query.raml.indexOf(".raml")
    var ramlFileName = './raml/'+uriParts.query.raml.substring(0,indexOfExtension)+'.raml';
    //res.send(uriParts.query);
    console.log(ramlFileName);

    raml.loadFile(ramlFileName).then(function(data){
      var config = null;
      console.log('--./templates'+uriParts.query.template)

      if(uriParts.query.template.length>0 && uriParts.query.template!='default')
        config = raml2html.getDefaultConfig('./templates/'+uriParts.query.template+'.html');
      else
        config = raml2html.getDefaultConfig();

      //console.log(config);

      console.log(data)
      console.log('---')
      console.log(data.resources[0].resources)
      console.log('-***--')
      console.log(generateIndex(data))
      data.console_link = uriParts.query.console;
      data.overview_link = uriParts.query.documentation;
      data.get_api_link = uriParts.query.get_api;

      raml2html.render(data, config).then(function(result){
        console.log("success");
        res.send(result);
      }, function(error){
        console.log("error", error);
        sendError(error);
      });
    })
  }

  //res.send(uriParts.query);
});


module.exports = router;
