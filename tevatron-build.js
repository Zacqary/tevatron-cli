#! /usr/bin/env node
/*!
 * Tevatron Builder v0.1.0
 * by Fast Company
 *
 * Copyright 2015 Mansueto Ventures, LLC and other contributors
 * Released under the MIT license
 *
 */
var fs = require('fs');
var uglify = require('uglify-js');
var argv = require('yargs')
			.usage('Usage: $0 --src [input directory] --target [output directory]')
			.demand(['src','target'])
			.alias('s','src')
			.alias('t','target')
			.alias('c', 'concat')
			.alias('m', 'minify')
			.alias('v', 'verbose')
			.argv;

var jsFiles = [];
var htmlFiles = [];
var fileCombos = [];

var catString = '';
var stringsToCat = [];
var sameNameCats = [];

var totalFiles = 0;
var scannedFiles = 0;

if (argv.src === argv.target && !argv.concat){
	console.log("WARNING: Source and target are the same folder. Adding tevatron_output/ to target to avoid overriding your source files\n");
}

scanDir(argv.src);
for (var i in jsFiles){
	totalFiles++;
}
for (var i in htmlFiles){
	totalFiles++;
}
for (var i in htmlFiles){
	scanHTMLFile(i);
}
for (var i in jsFiles){
	scanJSFile(i);
}

// Recursive function to scan all the files in the src directory and
// its subdirs, looking for JS and HTML files
function scanDir(path){
	var files = fs.readdirSync(path);
	var fileString;
	for (var i in files){
		fileString = path + '/';
		fileString += files[i];
		// Record the location of any .js and .html files
		if (files[i].slice(-3) === '.js'){
			var jsFileKey = fileString.replace('.js','');
			jsFiles[jsFileKey] = fileString;
		} else if (files[i].slice(-5) === '.html'){
			var htmlFileKey = fileString.replace('.html','');
			htmlFiles[htmlFileKey] = fileString;
		}
		// Dive into any subdirectories found
		if (fs.lstatSync(fileString).isDirectory() && fileString.indexOf('tevatron_output') === -1){
			scanDir(fileString);
		}
	}
}

// Scans a JS file for tevatron comments. If they exist, find its corresponding
// HTML file and smash them
function scanJSFile(fileKey){
	var jsPath = jsFiles[fileKey];
	fs.readFile(jsPath, function(err, jsData){
		scannedFiles++;
		var fileObj = {};
		if(Array.isArray(jsData.toString().match(/(?!\/\*\*tevatron) .+? ?= ?#.+?(?=\*\*\/)/g))){
			fileObj.js = jsPath;
			var htmlPath = htmlFiles[fileKey];
			if (htmlPath){
				fileObj.html = htmlPath;
				if (!fileCombos[fileKey]){
					fileCombos[fileKey] = fileObj;
					fs.readFile(htmlPath, function(err, htmlData){
						var smashedData = smash(htmlData, jsData);
						processSmash(smashedData, {filePath: jsPath, fileKey: fileKey, catIndex: -1});
					});
				}
			}
		} else if (Array.isArray(jsData.toString().match(/\/\*\*tevatron notemplate\*\*\//g))){
			fileCombos[jsPath] = fileObj;
			processSmash(jsData.toString(), {filePath: jsPath, fileKey: jsPath, notemplate: true, catIndex: -1});
		}
	});
}

// Scans an HTML file for <script> tags. If they exist, smash the scripts.
function scanHTMLFile(fileKey){
	var htmlPath = htmlFiles[fileKey];
	fs.readFile(htmlPath, function(err, htmlData){
		scannedFiles++;
		var fileObj = {};
		// Regex to find script tags and extract inline script
		var scriptTagPattern = /(<script[^>]*?>)([^]*?)(<\/script>)/g; 
		// Regex to find external script tags
		var scriptSrcPattern = /(<script .*?)(src ?= ?["'])([^"']*)(["'].*?)(>)/g;
		var scriptTags = htmlData.toString().match(scriptTagPattern);
		if (Array.isArray(scriptTags)){
			fileObj.html = htmlPath;
			var inlineKey = htmlPath+'-inline';
			var inlineJS = [];
			for (var i in scriptTags){
				// Check if this is an external script
				var srcMatch = new RegExp(scriptSrcPattern).exec(scriptTags[i]);
				if (Array.isArray(srcMatch)){
					var jsPath = pathToPath(htmlPath, srcMatch[3]);
					fileObj.js = jsPath;
					fileCombos[fileKey] = {html: htmlPath, js: jsPath};
					smashExternalScript(jsPath, htmlData, fileKey, i);
				}
				// If this is an inline script
				else {
					var innerMatch = new RegExp(scriptTagPattern).exec(scriptTags[i]);
					var jsString = innerMatch[2];
					if (!fileCombos[inlineKey]){
						fileObj.js = "inline";
						fileCombos[inlineKey] = fileObj;
					}
					var smashedData = smash(htmlData, jsString);
					var inlineJSString = "// === script tag " + i + " ===";
					inlineJSString += smashedData + "\n";
					inlineJS.push({string: inlineJSString, catIndex: i});
				}
			}
			if (fileCombos[inlineKey]){
				processSmash(inlineJS, {filePath: inlineKey, fileKey: inlineKey, inline: true, inlineFileName: htmlPath});
			}
		}
	});

	function smashExternalScript(jsPath, htmlData, fileKey, index){
		fs.readFile(jsPath, function(err, jsData){
			if (err){
				throw err;
			}
			var smashedData = smash(htmlData, jsData);
			processSmash(smashedData, {filePath: jsPath, fileKey: fileKey, catIndex: index});
		});
	}
}

function pathToPath(src, target){
	if (src.lastIndexOf('/') > -1){
		return src.substr(0,src.lastIndexOf('/')+1) + target;
	} else {
		return target;
	}
}

function processSmash(data, args){
	if (argv.concat){
		if (argv.verbose){
			if (args.notemplate){
				console.log(args.fileKey + '.js ready for concatenation');
			} else if (args.inline){
				console.log(args.inlineFileName + ' and inline script smashed together and ready for concatenation');
			} else {
				console.log(args.fileKey + '.html and .js smashed together and ready for concatenation');
			}
		}
		var catThis = '';
		catThis += '// =========================\n';
		catThis += '// '+args.filePath+'\n';
		catThis += '// =========================\n';
		if (args.inline){
			for (var i in data){
				stringsToCat[data[i].catIndex] = catThis + data[i].string;
			}
		} else {
			catThis += data + '\n';
			if (args.catIndex === -1){
				sameNameCats.push(catThis);
			} else {
				stringsToCat[args.catIndex] = catThis;
			}
			
		}
		fileCombos[args.fileKey].smashed = true;
		tryConcat();
	} else {
		var fileName = args.filePath.substr(args.filePath.lastIndexOf('/'));
		if (args.filePath.lastIndexOf('/') === -1){
			fileName = args.filePath;
		}
		if (argv.target === argv.src){
			fileName = 'tevatron_output/' + fileName;
		}
		if (args.inline){
			var dataString = '';
			for (var j in data){
				dataString += data[j].string;
			}
			data = dataString;
		}
		writeFile(data, argv.target + '/' + fileName, function(){
			if (argv.verbose){
				if (args){
					if (args.notemplate){
					console.log(args.fileKey + '.js scanned, no template to smash');
					} else if (args.inline){
						console.log(args.inlineFileName + '.html and inline script smashed together and saved');
					}
				} else {
					console.log(args.fileKey + '.html and .js smashed together and saved');
				}
			}
			fileCombos[args.fileKey].smashed = true;
			tryFinishedSmashing();
		});
	}	
}

function tryDone(){
	if (scannedFiles < totalFiles){
		return false;
	}
	for (var i in fileCombos){
		if (!fileCombos[i].smashed){
			return false;
		}
	}
	return true;
}

function tryFinishedSmashing(){
	if (tryDone()){
		console.log('All files smashed together successfully');
	}
}

function tryConcat(){
	if (tryDone()){
		catString = '';
		for (var i in stringsToCat){
			catString += stringsToCat[i];
		}
		for (var j in sameNameCats){
			catString += sameNameCats[j];
		}
		writeFile(catString, argv.target, function(){
			console.log('All files smashed and concatenated successfully');
		});
	}
}

function writeFile(data, fileName, callback){
	var output = fileName;
	if (output.slice(-3) !== '.js'){
		output += '.js';
		if (argv.minify){
			output = output.substring(0, output.length-3) + '.min.js';
		}
	} 
	var dirStruct = output.split('/');

	if (dirStruct.length > 1){
		for (var x in dirStruct){
			var path = dirStruct[0];
			for (y = 1; y < x; y++){
				path += '/' + dirStruct[y];
			}
			var stats;
			try {
				stats = fs.lstatSync(path);
				if (!stats.isDirectory){
					fs.mkdirSync(path);
				}
			} catch(e){
				fs.mkdirSync(path);
			}
		}
	}

	if (argv.minify){
		var uglified = uglify.minify(data, {fromString: true});
		writeIt(uglified.code);
	} else {
		writeIt(data);
	}

	function writeIt(data){
		fs.writeFile(output, data, function(err){
			if (err){
				throw err;
			}
			callback();
		});
	}
	
}

function smash(htmlFile, jsFile){
	var jsString = jsFile;
	if (typeof jsString !== "string"){
		jsString = jsString.toString();
	}
	var htmlFileString = htmlFile;
	if (typeof htmlFile !== "string"){
		htmlFileString = htmlFileString.toString();
	}

	// Get Template IDs
	var commentPattern = /(\s*\/\*[* ]tevatron )(.+? ?[=:] ?#.+?)([* ]\*\/)/g;
	var comments = jsString.match(commentPattern);
	var templateVarIDs = [];
	for (var x in comments){
		templateVarIDs.push(new RegExp(commentPattern).exec(comments[x])[2]);
	}
	var vars = [];
	var templates = [];
	for (var i in templateVarIDs){
		var thisVar = templateVarIDs[i].match(/[^ =:]+(?=[ :=])/g);
		var thisOperator = templateVarIDs[i].match(/ ?[:=] ?/g);
		if (thisVar){
			vars[i] = {var: thisVar[0], operator: thisOperator[0]};
		} else {
			throw ('No variable specified: '+templateVarIDs[i]);
		}

		var thisTemplate = templateVarIDs[i].match(/#.+/g);
		if (thisTemplate){
			templates[i] = thisTemplate[0];
		} else {
			throw ('No template ID specified: '+templateVarIDs[i]);
		}
	}

	// Remove whitespace between tags
	htmlFileString = htmlFileString.replace(/\n(\s+)?/g, '');

	// Remove HTML comments
	htmlFileString = htmlFileString.replace(/<!--[^]*?-->/g, '');

	for (i in templates){
		var pattern = new RegExp('<template id ?= ?["\']' + 
			templates[i].substring(1) + '["\'] ?>(.*?)(?=<\/template>)','g');
		var matches = htmlFileString.match(pattern);
		if (Array.isArray(matches)){
			var htmlString = matches[0];
			// Remove <template> tags
			htmlString = htmlString.replace(/(<template(.*?)>)/g,'');

			// Change single quotes to double quotes
			htmlString = htmlString.replace(/'+/g, '"');
			
			// Grab <style> tags
			var styleTags = htmlString.match(/<style>(.*?)<\/style>/g);
			htmlString = htmlString.replace(/<style>(.*?)<\/style>/g,'');
			var styleString = null;
			if (Array.isArray(styleTags)){
				styleString = '';
				styleTags.forEach(function(tag, index){
					var thisStyle = tag;
					thisStyle = thisStyle.replace(/<\/?style>/g,'');
					styleString += thisStyle;
				});
			}
			
			// Grab <link>ed stylesheets
			var linkTags = htmlString.match(/<link .*?rel=["'](alternate)? ?stylesheet ?(alternate)?["'].*?>/g);
			htmlString = htmlString.replace(/<link .*?rel=["'](alternate)? ?stylesheet ?(alternate)?["'].*?>/g,'');
			if (Array.isArray(linkTags)){
				linkTags.forEach(function(tag){
					var href = new RegExp('href=["\'](.*?)["\']','g').exec(tag)[1];
					
				});
			}

			// Replace the /**tevatron...**/ with a variable declaring htmlString and styleString
			var htmlDeclare = '';
			if (vars[i].operator.indexOf("=") > -1){
				htmlDeclare += "var ";
			}
			htmlDeclare += vars[i].var+vars[i].operator+"{html: '" + htmlString + "'";
			if (styleString !== null){
				htmlDeclare += ", css: '" + styleString + "'";
			}
			htmlDeclare += "}";
			if (vars[i].operator.indexOf("=") > -1){
				htmlDeclare += ";";
			} else if (vars[i].operator.indexOf(":") > -1){
				htmlDeclare += ",";
			}
			var jsPattern = new RegExp("\\/\\*[* ]tevatron .+? ?[=:] ?"+templates[i]+"[* ]\\*\\/", "g");
			jsString = jsString.replace(jsPattern, htmlDeclare);
		}
	}
	
	return jsString;
}
