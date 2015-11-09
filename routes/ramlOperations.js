var express = require('express');
var router = express.Router();

var raml = require('raml-parser');
var raml2html = require('raml2html');
var url = require('url');
var marked = require('marked');
var path = require("path");
var swig = require('swig');
var fs = require("fs");
var colors = require("colors");

var ramlFunctions = require('./ramlFunctions.js')
/*
Global variables
 */
var all_templates = "";
var all_index = "";
var all_summary = "";
var dataHead;

function parseResources(ramlData, baseUri, resources, parentRUri, parentUriParameters) {
  //console.log(resources.length);
  for (var resourceKey in resources) {

    //console.log(resourceKey, resources[resourceKey].relativeUri);
    //console.log("all Methods", resource["methods"]);

    currentPath = parentRUri + resources[resourceKey].relativeUri;
    /********************************/
    var uripars = []

    for (var uriParKey in resources[resourceKey]["uriParameters"]) {
      ouripar = resources[resourceKey]["uriParameters"][uriParKey];
      ouripar.key = uriParKey;
      ouripar.text = (ouripar.required ? "required " : "optional ") + (ouripar.type == "number" ? "float" : ouripar.type);
      //console.log(ouripar.text);F
      uripars.push(ouripar);
    }

    /* ADDING PARENT URI PARAMETERS */
    if(parentUriParameters != null) for (var uriParKey in parentUriParameters) {
      //console.log(uriParKey.red,'\n',parentUriParameters);
      ouripar = parentUriParameters[uriParKey];
      ouripar.key = uriParKey;
      ouripar.text = (ouripar.required ? "required " : "optional ") + (ouripar.type == "number" ? "float" : ouripar.type);
      //console.log(ouripar.text);
      uripars.push(ouripar);
    }
    /*END ADDING PARENT URI PARAMETERS */
    /*********************************************/
    var anchorBase = "";
    var dataIndex = new Object();
    dataIndex.methods = [];

    if (ramlFunctions.whatIsIt(resources[resourceKey]["methods"]) != "undefined") {
      var dataHeadTempl = new Object();
      //console.log('157',resources[resourceKey]);
      if(resources[resourceKey]["description"]!=undefined)
        dataHeadTempl["description"] = resources[resourceKey]["description"];
      else
        dataHeadTempl["description"] = ""
      if(resources[resourceKey]["displayName"]!=undefined)
        dataHeadTempl["displayName"] = resources[resourceKey]["displayName"];
      else
        dataHeadTempl["displayName"] = resources[resourceKey]["relativeUri"].replace('/','');
      //if(ramlFunctions.whatIsIt(dataHeadTempl["displayName"]) == "undefined"){
      //    throw "Undefined 'displayName' for method in " + JSON.stringify(resources[resourceKey], null, 3);
      //}
      //if(ramlFunctions.whatIsIt(dataHeadTempl["description"]) == "undefined"){
      //    throw "Undefined 'description' for method in " + JSON.stringify(resources[resourceKey], null, 3);
      //}
      /*
       TODO get description from documentation of the raml root section
       */
      anchorBase = ramlFunctions.generateAnchor(dataHeadTempl["displayName"])
      dataHeadTempl["anchor"] = anchorBase;
      dataHeadTempl["cleanKey"] = ramlFunctions.cleanKey;
      dataHeadTempl["renderMD"] = ramlFunctions.renderMD;
      all_templates += ramlFunctions.compileTemplate(dataHeadTempl, "../templates/api_market/serviceInfoBlock.html");
      dataIndex.anchor = anchorBase;
      dataIndex.displayName = dataHeadTempl["displayName"];
    }

    for (var methodKey in resources[resourceKey]["methods"]) {
      dataobject = new Object();
      dataobject.queryParams = [];
      omethod = resources[resourceKey]["methods"][methodKey];
      omethod.description = marked(omethod.description+"");
      omethod.description+="";
      omethod.description = ramlFunctions.removeTags(omethod.description);

      dataobject.methodData = omethod;
      if(ramlFunctions.whatIsIt(omethod.method) == "undefined"){
        throw "Undefined method name for " + + JSON.stringify(resources[resourceKey], null, 3);
      }

      dataobject.anchor = anchorBase + "-" + omethod.method.toLowerCase();
      dataobject.path = currentPath;
      dataobject.uriParams = uripars;
      dataobject.baseUri = baseUri;
      dataobject.fullUri = baseUri + currentPath;

      if(omethod.method == "post" && omethod.body && omethod.body['application/x-www-form-urlencoded'] && omethod.body['application/x-www-form-urlencoded']['formParameters']){
        dataobject.postFormPars = omethod.body['application/x-www-form-urlencoded']['formParameters'];
        //console.log("BODY", dataobject.postBodyPars);
      }
      else if(omethod.method == "post"){
        dataobject.postBodyPars = omethod.body;
        //console.log(omethod.body);
      }

      dataIndex.methods.push(dataobject);

      if(omethod.headers != null){
        dataobject.headers = omethod.headers
      }
      else {
        dataobject.headers = {}
      }

      if(omethod["securedBy"] && omethod["securedBy"].indexOf("basic") != -1 ){
        dataobject.headers["Authorization"] = { "description": "This header should be included only when using Basic Access Authorization.", "example": "Basic YXBwLmJidmEudGVzdDoxMjM0NTY3OA==", "displayName": "Authorization", "type": "string", "required":true };
      }

      //console.log("QUERY PARAMS", JSON.stringify(omethod.queryParameters, null, 2));
      for (var qParamKey in omethod.queryParameters) {
        oqueryparam = omethod.queryParameters[qParamKey];
        oqueryparam.key = qParamKey;
        oqueryparam.text = (oqueryparam.required ? "required " : "optional ") + (oqueryparam.type == "number" ? "float" : oqueryparam.type) +".";
        dataobject.queryParams.push(oqueryparam);
      }

      //Generate examples for curl and java
      dataobject["resolvedUri"] = ramlFunctions.resolveFullUri(ramlData, dataobject.fullUri, dataobject.uriParams)
      qpars = "";
      for(key in dataobject.queryParams){
        if(dataobject.queryParams[key]["required"])
          qpars += dataobject.queryParams[key]["key"]+"="+dataobject.queryParams[key]["example"]+"&";
      }
      //console.log('point1')
      dataobject["resolvedUriParams"]=dataobject["resolvedUri"]+(qpars!=""?"?"+qpars.substring(0, qpars.length-1) :"");
      dataobject["url"] = {}
      tempurl = dataobject["resolvedUri"].split(":");
      dataobject["url"]["protocol"] = tempurl[0];
      //console.log('point2',tempurl)
      tempurl = tempurl[1].substring(2);
      dataobject["url"]["host"] = tempurl.substring(0, tempurl.indexOf("/"));
      dataobject["url"]["path"] = tempurl.substring(tempurl.indexOf("/"));
      //console.log('point3')

      if(ramlFunctions.whatIsIt(omethod.body) == "undefined"){
        dataobject["curlexample"] = ramlFunctions.compileTemplate(dataobject, "../templates/code/example.nobody.curl");
        dataobject["javaexample"] = ramlFunctions.compileTemplate(dataobject, "../templates/code/example.nobody.java");
        dataobject["pythexample"] = ramlFunctions.compileTemplate(dataobject, "../templates/code/example.nobody.py");
      }
      else {
        if(omethod.body['application/x-www-form-urlencoded'] && omethod.body['application/x-www-form-urlencoded']['formParameters']){
          dataobject["curlexample"] = ramlFunctions.compileTemplate(dataobject, "../templates/code/example.form.curl");
          dataobject["javaexample"] = ramlFunctions.compileTemplate(dataobject, "../templates/code/example.form.java");
          dataobject["pythexample"] = ramlFunctions.compileTemplate(dataobject, "../templates/code/example.form.py");
        }
        else{
          dataobject["curlexample"] = ramlFunctions.compileTemplate(dataobject, "../templates/code/example.body.curl");
          dataobject["javaexample"] = ramlFunctions.compileTemplate(dataobject, "../templates/code/example.body.java");
          dataobject["pythexample"] = ramlFunctions.compileTemplate(dataobject, "../templates/code/example.body.py");
        }
      }

      dataobject["cleanKey"] = ramlFunctions.cleanKey;
      dataobject["renderMD"] = ramlFunctions.renderMD;
      dataobject["addSpaces"] = ramlFunctions.addSpaces;

      //console.log(JSON.stringify(dataobject, null, 3))

      all_templates += ramlFunctions.compileTemplate(dataobject, "../templates/api_market/serviceDocumentationBlock.html");

    }

    //console.log("methods size ", dataIndex.methods.length);

    if (dataIndex.methods.length > 0) {
      //console.log("entrando", dataIndex);
      all_index += ramlFunctions.compileTemplate(dataIndex, "../templates/api_market/sidebarListServices.html")
      //console.log("saliendo");
    }

    if (resources[resourceKey].hasOwnProperty("resources")) {
      parseResources(ramlData, baseUri, resources[resourceKey]["resources"], currentPath, resources[resourceKey]["uriParameters"])
    }

  }

}

function sendError(res, errorCode, errorMessage){
  var data = {};
  if(errorMessage!=undefined){
    data = {
      error: errorCode,
      description: errorMessage
    }
  } else {
    if(errorCode==401)
      data = {
        error: errorCode,
        description: 'Requiered params not found'
      }
    else if(errorCode==404)
      data = {
        error: errorCode,
        description: 'RAML file not found'
      }
    else
      data = {
        error: 404,
        description: 'Unexpected error'
      }
  }
  res.send(data);
}

/* GET ramlOperations listing. */
router.get('/api_market', function(request, response, next) {
  console.log('here',request.url)
  var uriParts = url.parse(request.url, true, true);
  if (uriParts.path == "/favicon.ico" || uriParts.path.indexOf(".raml") == -1) {
    console.log("stopping..", uriParts.pathname);
    var output = "";
    fs.realpath(__dirname, function(err, path) {
      if (err) {
        console.log(err);
        return;
      } else {
        output +='Path is : ' + path +"\n";
        fs.readdir(__dirname, function(err, files) {
          if (err) return;
          files.forEach(function(f) {
            output +='Files: ' + f+"\n";
          });
          response.writeHead(200);
          response.write(output);
          response.end();
        });
      }
    });



  } else {

    //console.log(uriParts, request.url, request);
    console.log("Generating DOC for", request.url);

    var urlRamlToParse = ""
    //if(uriParts.query && uriParts.query.local && uriParts.query.local == "true"){
    //  urlRamlToParse = "."+uriParts.pathname;
    //} else {
    //  urlRamlToParse = "http://apiraml.digitalservices.es:8001" + uriParts.pathname;
    //}
    if(uriParts.query && uriParts.query.raml && uriParts.query.raml.length>0){
      urlRamlToParse = "raml/"+uriParts.query.raml;
    } else {
      sendError(response,404,'Filename not provided')
    }
    console.log(urlRamlToParse);
    raml.loadFile(urlRamlToParse).then(function(data) {
      try {
        //console.log(JSON.stringify(data, null, 3))
        if(uriParts.query && uriParts.query.output && uriParts.query.output == "raml2html"){
          var config = raml2html.getDefaultConfig();
          console.log('rameleando')
          console.log(uriParts.query.output)
          console.log(data)
          raml2html.render(data, config, function(htmlString){
            console.log("success");

            headers = {"Content-Type": "text/html; charset=utf-8"};

            response.writeHead(200, headers);
            response.write(htmlString);
            response.end();

          }, function(error){
            console.log("error", error);
          });
        }
        else{
          /* Generating info for headers */
          console.log(data);
          dataHead = new Object();
          dataHead["documentation"] = [];
          dataHead["api_description"] = [];
          dataHead['documentation_article'] = [];
          //console.log("***************************");

          console.log("title")
          if(ramlFunctions.whatIsIt(data["title"])!="undefined" &&  data["title"].length>0)
            dataHead["api_description"]['title']=data["title"];
          console.log("version")
          if(ramlFunctions.whatIsIt(data["version"])!="undefined" && data["version"].length>0)
            dataHead["api_description"]['version']=data["version"];
          console.log("protocols")
          if(ramlFunctions.whatIsIt(data["protocols"])!="undefined" &&  data["protocols"].length>0)
            dataHead["api_description"]['protocols']=data["protocols"];
          console.log("baseUri")
          if(ramlFunctions.whatIsIt(data["baseUri"])!="undefined" &&  data["baseUri"].length>0)
            dataHead["api_description"]['uris']=ramlFunctions.resolveUris(data,data.baseUri,data.baseUriParameters);
          //console.log("END API DES")
          //dataHead["version"] = data["version"];
          //dataHead["title"] = data["title"];
          //dataHead["protocols"] = data["protocols"];
          dataHead["baseUri"] = ramlFunctions.resolveFullUri(data,data.baseUri,null);

          if(ramlFunctions.whatIsIt(data["documentation"])!="undefined")
          //console.log("\n\n\n\n\-----------n\n\n\n"+data["documentation"].length+"\n\n++\n\n\n\n\n")
          //console.log(dataHead['documentation_article'])
          //console.log("\n\n\n++\n\n\n\n\n"+data["documentation"]+"-----------\n\n\n\n\n\n\n\n")
            for(i=0;i<data["documentation"].length;i++){
              //if(data["documentation"][i]["title"]=="Description"){
              ////    dataHead["api_description"] = marked(data["documentation"][i]["content"]+"");
              ////    dataHead["api_description"] = removeTags(dataHead["api_description"])
              //} else{
              docitem = {};
              //console.log('XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX')
              //console.log(data["documentation"][i]["content"])
              //console.log('XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX')
              docitem.doc = marked(data["documentation"][i]["content"]+"");
              //console.log(docitem.doc)
              //console.log('XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX')
              docitem.doc = ramlFunctions.removeTags(docitem.doc);
              //console.log(docitem.doc)
              //console.log('XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX')
              docitem.title = data["documentation"][i]["title"];
              docitem.displayName = data["documentation"][i]["title"];
              docitem.description = data["documentation"][i]['content']
              docitem.description = marked(data["documentation"][i]['content'])
              //console.log(marked(data["documentation"][i]['content']))
              docitem.anchor = ramlFunctions.generateAnchor("description-"+docitem.displayName)
              dataHead["documentation"].push(docitem);
              //console.log(docitem)

              out = ramlFunctions.formatedApiMarket(ramlFunctions.compileTemplate(docitem, "../templates/api_market/serviceInfoBlock.html"));

              //console.log('************************')
              ////console.log(data["documentation"][i])
              //console.log(docitem)
              //console.log('-----------------------')
              //console.log(out)
              //console.log('CCCCCCCCCCCCCCCCCCCCCC')

              dataHead['documentation_article']+=out
              //if(dataHead['documentation_article'].indexOf("undefined")>-1){
              //    console.log(i,'---')
              //    console.log(dataHead['documentation_article'])
              //    console.log('wowowoowow')
              //} else {
              //    console.log('biiiiii')
              //    //console.log(dataHead['documentation_article'])
              //    console.log('biiiiii')
              //}
              //}

              //console.log(dataHead['documentation_article'])
            }
          //console.log("*************************** BEFORE DOC");
          //console.log(dataHead);
          //console.log("*************************** AFTER DOC");

          /***************/
//TODO generate the correct links
          dataHead["overview_link"]="PUT_API_NAME_WITH_-_INSTEAD_OF_SPACES";
          //dataHead["console_link"]="./console";
          dataHead["console_link"]="";
          //dataHead["get_api_link"]="PUT_API_NAME_WITH_UNDERSCORES_INSTEAD_OF_SPACES";
          dataHead["get_api_link"]="";
          /***************/

          all_templates = "";
          all_index = "";
          all_summary = "";

          //parseMainResources(data,dataHead["baseUri"])
          parseResources(data, dataHead["baseUri"], data["resources"], "", null);

          var template = "";

          if (uriParts.query && uriParts.query.template && uriParts.query.template == "security") {
            console.log('security');
            template = swig.compileFile(__dirname+"/../templates/api_market/securityTemplate.html");
          } else if (uriParts.query && uriParts.query.template && uriParts.query.template == "api_market_full") {
            template = swig.compileFile(__dirname + "/../templates/api_market/bodyTemplateFullApiMarket.html");
          } else if (uriParts.query && uriParts.query.template && uriParts.query.template == "api_market") {
            template = swig.compileFile(__dirname + "/../templates/api_market/bodyTemplate.html");
          } else {
            template = swig.compileFile(__dirname + "/../templates/api_market/bodyTemplate.html");
          }

          var headers = {};

          dataHead["all_templates"] = all_templates;
          if(ramlFunctions.whatIsIt(dataHead["documentation"])!="undefined"){
            dataHead["documentation_index"] = ramlFunctions.compileTemplate(dataHead, "../templates/api_market/sidebarListDocumentation.html");
          }
          dataHead["all_index"] = all_index;
          var output = template(dataHead);
          var content = "";

          if (uriParts.query && uriParts.query.output && uriParts.query.output == "onlybody") {
            headers = {
              "Content-Type": "text/plain; charset=utf-8"
            };
            content = output.substring(output.indexOf("<body>")+6,output.indexOf("</body>")-1);
          } else {
            headers = {
              "Content-Type": "text/html; charset=utf-8"
            };
            content = output;
          }

          //ramlFunctions.toFile((uriParts.pathname).substr(1)+".html",output.substring(output.indexOf("<!-- BUTTONS BAR -->")-1,output.indexOf("<!-- CONTENT BLOCK END-->")-1));
          ramlFunctions.toFile((urlRamlToParse).substr(0,urlRamlToParse.indexOf('.raml'))+".html",output.substring(output.indexOf("<!-- BUTTONS BAR -->")-1,output.indexOf("<!-- CONTENT BLOCK END-->")-1));

          response.writeHead(200, headers);
          response.write(content);
          response.end();

          console.log("All done...".rainbow);

        }


      } catch (e) {
        console.error("Error inner -", e.message);
        sendError(response,501, error)
      }

    }, function(error) {
      console.error("Error outer -".red, error.context.cyan, "," + error.message);
      sendError(response,501, error)
    });

  }
});


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

      console.log(config);

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
