var raml = require('raml-parser');
var swig = require('swig');
var marked = require('marked');
var colors = require("colors");
var fs = require("fs");

module.exports = {
    removeHtmlComments: function(text) {
        var fixedText = text;
        while(fixedText.indexOf('<!--')!=-1){
            var indexStart = fixedText.indexOf('<!--');
            var indexEnd = fixedText.indexOf('-->');
            var comment = fixedText.substring(indexStart,indexEnd+3);
            //console.log(comment);
            fixedText = fixedText.replace(comment,"");
        }
        return fixedText.trim().replace(/^\s*\n/gm,'');
    },

    removeTags: function(text) {
        if(text.trim()!='<p>undefined</p>' && text.trim()!='<p>null</p>'){
            //console.log('\ntext: ',text,'\nlength: ',text.length,'\n----------\n');
            text = text.replace(/<pre><code>/g, "");
            text = text.replace(/<\/code><\/pre>/g, "");
            text = text.replace(/<p>/g, "");
            text = text.replace(/<\/p>/g, "");
            while(text.indexOf('id=')!=-1){
                var indexStart = text.indexOf('id');
                var indexEnd = text.indexOf('\"',indexStart+4);
                var textToRemove = text.substring(indexStart,indexEnd+1);
                //console.log(textToRemove);
                text = text.replace(textToRemove,'');
            }
        } else {
            console.log('NOT DEFINED');
            text = '';
        }
        return text;
    },

    toFile: function(fileName, content){
        if(fs.existsSync(fileName)){
            fs.unlinkSync(fileName);
            console.log('deleted file: '.red,fileName.green);
        }
        content = this.removeHtmlComments(content);
        fs.writeFile(fileName, content, function(err) {
            if(err)
                console.error("Error".red, err);
            else
                console.log("output file".cyan, fileName.green, "was created!".cyan);
        });
    },

    generateAnchor: function(name){
        //console.log('NAME: '.red,name)
        //console.log('NEW N: '.cyan,name.toLowerCase().replace('.','').replace('\'','').split(' ').join('-'))
        return name.toLowerCase().replace('.','').replace('\'','').replace('&','').split(' ').join('-');
    },

    whatIsIt: function(object) {
        if (object === null) {
            return "null";
        } else if (object === undefined) {
            return "undefined";
        } else if (object.constructor === String) {
            return "String";
        } else if (object.constructor === Array) {
            return "Array";
        } else if (object.constructor === Object) {
            return "Object";
        } else if (object.constructor === Boolean) {
            return "Boolean";
        } else if (object.constructor === Number) {
            return "Number";
        } else {
            return "don't know but" + object.constructor;
        }
    },

    resolveFullUri: function(ramlData, fullUri, uriParams) {

        uriResolved = fullUri //"https://{endpoint}/{apiPath}/{version}/tvm/{bookTitle}"
        for (key in ramlData.baseUriParameters) {
            //console.log(key, ramlData.baseUriParameters[key])
            if(this.whatIsIt(ramlData.baseUriParameters[key]["example"]) == "undefined" &&
                this.whatIsIt(ramlData.baseUriParameters[key]["enum"]) == "undefined"){
                throw "BaseUriParams must have 'example' value or enum. {"+key+"} " + fullUri;
            }
            tempvaluri = "";
            if (this.whatIsIt(ramlData.baseUriParameters[key]["example"]) == "undefined") {
                tempvaluri = ramlData.baseUriParameters[key]["enum"][0];
            } else {
                tempvaluri = ramlData.baseUriParameters[key]["example"]
            }
            uriResolved = uriResolved.replace("{" + key + "}", tempvaluri);
        }
        for (key in uriParams) {
            if(this.whatIsIt(uriParams[key]["example"]) == "undefined" &&
                this.whatIsIt(uriParams[key]["enum"]) == "undefined"){
                throw "URIParams must have 'example' value or enum. {"+uriParams[key]["key"]+"} "+ fullUri;
            }
            tempvaluri = "";
            if (this.whatIsIt(uriParams[key]["example"]) == "undefined") {
                tempvaluri = uriParams[key]["enum"][0];
            } else {
                tempvaluri = uriParams[key]["example"]
            }
            uriResolved = uriResolved.replace("{" + uriParams[key]["key"] + "}", tempvaluri);
        }
        return uriResolved;
    },

    resolveUris: function(ramlData, fullUri, uriParams) {

        uriResolved = fullUri //"https://{endpoint}/{apiPath}/{version}/tvm/{bookTitle}"
        uris = []
        if(fullUri.indexOf('{')==-1){
            //throw "baseUri must have a parameter - "+fullUri;
        } else {
            if(this.whatIsIt(ramlData.baseUriParameters) == "undefined" || ramlData.baseUriParameters.length <= 0 ){
                throw "BaseUriParams must be provided";
            } else {
                var tempUri = uriResolved;
                for (key in ramlData.baseUriParameters) {
                    if(this.whatIsIt(ramlData.baseUriParameters[key]["example"]) == "undefined" &&
                        this.whatIsIt(ramlData.baseUriParameters[key]["enum"]) == "undefined"){
                        throw "BaseUriParams must have 'example' value or enum. {"+key+"} " + fullUri;
                    }
                    if(key != 'env'){
                        var paramValue;
                        if (this.whatIsIt(ramlData.baseUriParameters[key]["example"]) == "undefined") {
                            paramValue = ramlData.baseUriParameters[key]["enum"][0];
                        } else {
                            paramValue = ramlData.baseUriParameters[key]["example"]
                        }
                        tempUri = tempUri.replace("{" + key + "}", paramValue);

                    }
                    //console.log("-------------****",tempUri)
                }
                if (this.whatIsIt(ramlData.baseUriParameters["env"]["example"]) == "undefined") {
                    for(value in ramlData.baseUriParameters["env"]["enum"]){
                        //console.log(tempUri.replace("{" + key + "}", ramlData.baseUriParameters["env"]["enum"][value]))
                        uris.push(tempUri.replace("{" + key + "}", ramlData.baseUriParameters["env"]["enum"][value]))
                    }
                } else {
                    //console.log(tempUri.replace("{" + key + "}", ramlData.baseUriParameters["env"]["example"]))
                    uris.push(tempUri.replace("{" + key + "}", ramlData.baseUriParameters["env"]["example"]))
                }
            }
        }
        //console.log(uris,'-----',uris.length)
        uriResolved = {}
        if(uris.length>1){
            for(uriIndex in uris){
                if( uris[uriIndex].indexOf('sbx')>1)
                    uriResolved.sandbox = uris[uriIndex];
                else
                    uriResolved.live = uris[uriIndex];
            }
        } else {
            uriResolved.live = uris[0];
        }
        //console.log('*****',uriResolved,'*****')
        return uriResolved;
    },

    compileTemplate: function(data, template) {
        var template = swig.compileFile(__dirname+"/"+template);
        var output = template(data);
        //toFile(destination, output);
        return output.trim();
    },

    addSpaces: function(stringToReplace){
        stringToReplace=stringToReplace+"";
        return stringToReplace.replace(/,/g,", ")
    },

    renderMD: function(stringToRender){
        //console.log("RENDERING", stringToRender);
        return marked(stringToRender);
    },

    cleanKey: function(stringToReplace) {
        stringToReplace=stringToReplace+""
        return stringToReplace.replace(/\//g, "-");
    },

    formatedApiMarket: function(compiledHtml){
        while(compiledHtml.indexOf('<a href')>-1)
            compiledHtml = compiledHtml.replace('<a href','<a class="api__documentation-link" href');
        return compiledHtml;
    }
};
