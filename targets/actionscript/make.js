
var path = require('path');

var sdkVersion = "1.0.0";

exports.putInRoot = true;

exports.makeClientAPI = function(api, sourceDir, apiOutputDir)
{
	console.log("Generating ActionScript3 client SDK to "+apiOutputDir);
	
	makeDatatypes(api, sourceDir, apiOutputDir);
	
	makeAPI(api, sourceDir, apiOutputDir);
	
	generateErrors(api, sourceDir, apiOutputDir);
	
	generateVersion(api, sourceDir, apiOutputDir);
}


function makeDatatypes(api, sourceDir, apiOutputDir)
{
	var templateDir = path.resolve(sourceDir, "templates");
	
	var modelTemplate = ejs.compile(readFile(path.resolve(templateDir, "Model.as.ejs")));
	var enumTemplate = ejs.compile(readFile(path.resolve(templateDir, "Enum.as.ejs")));
	
	for(var d in api.datatypes)
	{
		var datatype = api.datatypes[d];

		var modelLocals = {};
		modelLocals.datatype = datatype;
		modelLocals.getPropertyDef = getModelPropertyDef;
		modelLocals.getPropertyInit = getModelPropertyInit;
		var generatedModel = null;
		
		if(datatype.isenum)
		{
			generatedModel = enumTemplate(modelLocals);
		}
		else
		{
			modelLocals.needsPlayFabUtil = needsPlayFabUtil(datatype);
			generatedModel = modelTemplate(modelLocals);
		}

		writeFile(path.resolve(apiOutputDir, "com/playfab/models/"+datatype.name+".as"), generatedModel);
	}

}

function needsPlayFabUtil(datatype)
{
	for(var i in datatype.properties)
	{
		var property = datatype.properties[i];
		if(property.actualtype == 'DateTime')
			return true;
	}

	return false;
}


function makeAPI(api, sourceDir, apiOutputDir)
{
	console.log("Generating AcionScript "+api.name+" library to "+apiOutputDir);
	
	var templateDir = path.resolve(sourceDir, "templates");
	
	var apiTemplate = ejs.compile(readFile(path.resolve(templateDir, "API.as.ejs")));
	

	var apiLocals = {};
	apiLocals.api = api;
	apiLocals.getAuthParams = getAuthParams;
	apiLocals.getRequestActions = getRequestActions;
	apiLocals.getResultActions = getResultActions;
	apiLocals.getUrlAccessor = getUrlAccessor;
	apiLocals.authKey = api.name == "Client";
	var generatedApi = apiTemplate(apiLocals);
	writeFile(path.resolve(apiOutputDir, "com/playfab/PlayFabClientAPI.as"), generatedApi);
}

function generateErrors(api, sourceDir, apiOutputDir)
{
	var errorsTemplate = ejs.compile(readFile(path.resolve(sourceDir, "templates/Errors.as.ejs")));
	
	var errorLocals = {};
	errorLocals.errorList = api.errorList;
	errorLocals.errors = api.errors;
	var generatedErrors = errorsTemplate(errorLocals);
	writeFile(path.resolve(apiOutputDir, "com/playfab/PlayFabError.as"), generatedErrors);
}

function generateVersion(api, sourceDir, apiOutputDir)
{
	var versionTemplate = ejs.compile(readFile(path.resolve(sourceDir, "templates/PlayFabVersion.as.ejs")));
	
	var versionLocals = {};
	versionLocals.apiRevision = api.revision;
	versionLocals.sdkRevision = sdkVersion;
	var generatedVersion = versionTemplate(versionLocals);
	writeFile(path.resolve(apiOutputDir, "com/playfab/PlayFabVersion.as"), generatedVersion);
}


function getModelPropertyDef(property, datatype)
{
	var basicType = getPropertyASType(property, datatype);

	if(property.collection)
	{
		if(property.collection == 'array')
		{
			return property.name+':Vector.<'+basicType+'>';
		}
		else if(property.collection == 'map')
		{
			return property.name+':Object';
		}
		else
		{
			throw "Unknown collection type: "+property.collection+" for " +property.name+" in "+datatype.name;
		}
	}
	else
	{
		if(property.optional && (basicType == 'Boolean'
							 ||  basicType == 'int'
							 ||  basicType == 'uint'
							 ||  basicType == 'Number'))
			basicType = '*';
		return property.name+':'+basicType;
	}
}



function getPropertyASType(property, datatype)
{

	if(property.actualtype == 'String')
	{
		return 'String';
	}
	else if(property.actualtype == 'Boolean')
	{
		return 'Boolean';
	}
	else if(property.actualtype == 'int16')
	{
		return 'int';
	}
	else if(property.actualtype == 'uint16')
	{
		return 'uint';
	}
	else if(property.actualtype == 'int32')
	{
		return 'int';
	}
	else if(property.actualtype == 'uint32')
	{
		return 'uint';
	}
	else if(property.actualtype == 'int64')
	{
		return 'Number';
	}
	else if(property.actualtype == 'uint64')
	{
		return 'Number';
	}
	else if(property.actualtype == 'float')
	{
		return 'Number';
	}
	else if(property.actualtype == 'double')
	{
		return 'Number';
	}
	else if(property.actualtype == 'decimal')
	{
		return 'Number';
	}
	else if(property.actualtype == 'DateTime')
	{
		return 'Date';
	}
	else if(property.isclass)
	{
		return property.actualtype;
	}
	else if(property.isenum)
	{
		return 'String'
	}
	else if(property.actualtype == "object")
	{
		return 'Object';
	}
	else
	{
		throw "Unknown property type: "+property.actualtype+" for " +property.name+" in "+datatype.name;
	}
}


function getModelPropertyInit(property, datatype)
{
	if(property.isclass)
	{
		if(property.collection)
		{
			if(property.collection == 'array')
			{
				return "if(data."+property.name+") { "+property.name+" = new Vector.<"+property.actualtype+">(); for(var "+property.name+"_iter:int = 0; "+property.name+"_iter < data."+property.name+".Length; "+property.name+"_iter++) { "+property.name+"["+property.name+"_iter] = new "+property.actualtype+"(data."+property.name+"["+property.name+"_iter]); }}";
			}
			else if(property.collection == 'map')
			{
				return "if(data."+property.name+") { "+property.name+" = {}; for(var "+property.name+"_iter:String in data."+property.name+") { "+property.name+"["+property.name+"_iter] = new "+property.actualtype+"(data."+property.name+"["+property.name+"_iter]); }}";
			}
			else
			{
				throw "Unknown collection type: "+property.collection+" for " +property.name+" in "+datatype.name;
			}
		}
		else
		{
			return property.name+" = new "+property.actualtype+"(data."+property.name+");";
		}
	}
	else if(property.collection)
	{
		if(property.collection == 'array')
		{
			var asType = getPropertyASType(property, datatype);
			return property.name+" = data."+property.name+" ? Vector.<"+asType+">(data."+property.name+") : null;";
		}
		else if(property.collection == 'map')
		{
			return property.name+" = data."+property.name+";";
		}
		else
		{
			throw "Unknown collection type: "+property.collection+" for " +property.name+" in "+datatype.name;
		}
	}
	else if(property.actualtype == 'DateTime')
	{
		return property.name+" = PlayFabUtil.parseDate(data."+property.name+");";
	}
	else
	{
		return property.name+" = data."+property.name+";";
	}
	
}

function getAuthParams(apiCall)
{
	if(apiCall.auth == 'SecretKey')
		return "\"X-SecretKey\", PlayFabSettings.DeveloperSecretKey";
	else if(apiCall.auth == 'SessionTicket')
		return "\"X-Authorization\", SessionTicket";
	
	return "null, null";
}


function getRequestActions(apiCall, api)
{
	if(api.name == "Client" && (apiCall.result == "LoginResult" || apiCall.request == "RegisterPlayFabUserRequest"))
		return "request.TitleId = PlayFabSettings.TitleId != null ? PlayFabSettings.TitleId : request.TitleId;\n\t\t\tif(request.TitleId == null) throw new Error (\"Must be have PlayFabSettings.TitleId set to call this method\");\n";
	if(api.name == "Client" && apiCall.auth == 'SessionTicket')
		return "if (SessionTicket == null) throw new Error(\"Must be logged in to call this method\");\n"
	if(apiCall.auth == 'SecretKey')
		return "if (PlayFabSettings.DeveloperSecretKey == null) throw new Exception (\"Must have PlayFabSettings.DeveloperSecretKey set to call this method\");\n"
	return "";
}

function getResultActions(apiCall, api)
{
	if(api.name == "Client" && (apiCall.result == "LoginResult" || apiCall.result == "RegisterPlayFabUserResult"))
		return "SessionTicket = result.SessionTicket != null ? result.SessionTicket : SessionTicket;\n";
	else if(api.name == "Client" && apiCall.result == "GetCloudScriptUrlResult")
		return "PlayFabSettings.LogicServerURL = result.Url;\n";
	return "";
}

function getUrlAccessor(apiCall)
{
	if(apiCall.serverType == 'logic')
		return "PlayFabSettings.GetLogicURL()";

	return "PlayFabSettings.GetURL()";
}


