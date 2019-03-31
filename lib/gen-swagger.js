const path=require('path');
const fs=require('fs');
const scandir = process.cwd();
let schemaDef = {};

/**
 * get the path params from the available paths
 * @param path
 * @returns {{}}
 */
const processPathParams =(path)=>{
    return (!path)?{}:path
        .filter(pathParam => pathParam.match(/{{(.*?)}}/g))
        .map((pathParam) => {
            return {
                name: pathParam.replace(/{{(.*?)}}/, '$1'),
                in: "path",
                required: true,
                type: "string"
            }
        })
};

/**
 * get the header data
 * @param header
 * @returns {{}}
 */
const processHeaderParams = (header) => {
    return (!header)?{}:header.map((headerParam) => {
        return {
            name: headerParam.key,
            in: "header",
            required: !headerParam.disabled,
            type: typeof headerParam.value,
            default: headerParam.value
        }
    })
};

/**
 * get the query params
 * @param query
 * @returns {Array}
 */
const processQueryParams = (query) => {
    return (!query)?[]:query.map((queryParam) => {
        return {
            name: queryParam.key,
            in: "query",
            required: !queryParam.disabled,
            type: typeof queryParam.value,
            default: queryParam.value
        }
    })
};

/**
 * used to process the postman request and response to valid schema
 * @param data
 * @returns {number}
 */
const generateJSONSchema = (data) => {
    let name= Math.ceil(Math.random() * 10 * new Date().getTime());
    const processedSchema = Object.entries(data).map(([key, value]) => {
        const schema  = {
            name: key
        };
        if(value instanceof Array){
            schema["type"] = "array";
            schema["items"] = (typeof value[0] === "string")?
                {
                    "type": "string",
                    "example": value[0]
                } :
                {
                    "ref" : generateJSONSchema(value[0])
                }
        }else if(value instanceof Object){
            schema["ref"] = generateJSONSchema(value)
        }else{
            schema["type"] = typeof value;
            schema["example"] = (typeof value === "string")? value.replace(/"/g,"\""): value
        }
        return schema;
    });
    schemaDef[name] = processedSchema;
    return name;
}


/**
 * process the request body params
 * @param body
 * @returns {*}
 */
const processBodyParams = (body) => {
    let schemaName,schema = {};
    if(body && body.raw) {
        schemaName = generateJSONSchema(JSON.parse(body.raw.replace(/\n/g,"")))
    }
    try {
        return (body && body.raw)?[{
            in: "body",
            name: "body",
            required: true,
            schema: {
                ref: `${schemaName}`
            }
        }]:[];
    }catch(e){
        return []
    }
};

/**
 * process the response payload
 * @param response
 * @returns {string}
 */
const processReponse = (response) => {
    let schemaName = '';
    if(response) {
        schemaName = generateJSONSchema(JSON.parse(response.replace(/\n/g,"")))
    }
    return schemaName
};


/**
 * process a given postman node to a structure consumed by swagger yaml generator
 * @param collection
 */
const convertApiToSwaggerNode=(collection)=>{
    return collection.item.map((api) => {
        return {
            "url": `/${api.request.url.path.map(path => path.replace(/{{(.*?)}}/g,'{$1}')).join('/')}`,
            "method": api.request.method.toLowerCase(),
            "summary": api.name,
            "description": api.request.description,
            "parameters": ((request) => {
                return [
                    ...processHeaderParams(request.header),
                    ...processBodyParams(request.body),
                    ...processQueryParams(request.url.query),
                    ...processPathParams(request.url.path),
                ]
            })(api.request),
            "response": ((responses) => {
                return responses.map((response) => ({
                    "code": response.code,
                    "description": response.name,
                    "body": processReponse(response.body)
                }))
            })(api.response)
        }
    });
};

/**
 * generate a valid swagger from the given postman collection
 * @param json
 * @param options
 * @returns {string}
 */
const genMdString= (json, options) => {
    const collection = require(path.resolve(scandir,json));
    const {baseUrl = 'localhost', basePath= '/api/v1'} = options;
    const convertedNode = convertApiToSwaggerNode(collection);
const swagger = `swagger: '2.0'
info:
  version: "1.0.0"
  title: ${collection.info.name}
host: ${baseUrl}
basePath: ${basePath}
schemes:
- http
- https
paths: ${convertedNode.reduce((all, apiDef) => `${all}
  ${apiDef.url}:
    ${apiDef.method}:
      summary: "${apiDef.summary}" 
      ${apiDef.description ? `description: "${apiDef.description}"`: ''}
      produces:
      - application/json
      consumes:
      - application/json
      ${Object.keys(apiDef.parameters).length>0 ? `parameters:   ${apiDef.parameters.reduce((all, param) => `${all}
      - in: "${param.in}"
        name: "${param.name}"
        required: ${param.required}
        ${param.default ? `default: ${param.default}`: ''}
        ${param.type ? `type: "${param.type}"`:''}
        ${param.schema? `schema:
          $ref: "#/definitions/${param.schema.ref}"`:''}`, '')}` : ''} 
      responses:
      ${apiDef.response.length>0 ? apiDef.response.reduce((all, responseObj) => `${all}
        ${responseObj.code}:
          description: ${responseObj.description}
          schema:
            $ref: "#/definitions/${responseObj.body}"
       `,''): `
          200:
             description: Successful
       `}
`,'')}
`;
    const def =`
definitions: ${Object.entries(schemaDef).reduce((all, [defKey, defValue]) => `${all}
  ${defKey}:
    type: "object"
    properties: ${defValue.reduce((properties, property) => `${properties}
      ${property.name}:
        ${property.type ? `type: "${property.type}"`: ''}
        ${property.example ? `example: "${property.example}"`: ''}
        ${property.ref ? `$ref: "#/definitions/${property.ref}"`: ''}
        ${property.type === "array" ? `items:
           ${property.items.type ? `
           type: "${property.items.type}"`: ''}
           ${property.items.ref ? `
             $ref: "#/definitions/${property.items.ref}"`: ''}
           `: ''}
      `, '')}
  `, '')}`;
    return `${swagger}${def}`
};

/**
 * write the file to file system
 * @param json
 * @param options
 */
const genMd = (json, options = {}) => {
    schemaDef = {};
    fs.writeFile(path.resolve(scandir, options.out ? options.out :'swagger.yml'),genMdString(json, options), (err, val) => {
        return err && console.log(err) || console.log("generated swagger.yaml");
    });
};

module.exports  = {genMd};
