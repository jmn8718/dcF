var express = require('express');
var router = express.Router();

var raml = require('raml-parser');
var raml2html = require('raml2html');
var url = require('url');

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
