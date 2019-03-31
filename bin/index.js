#!/usr/bin/env node
const {genMd} = require('../lib/gen-swagger');
const processedOptions = (() => {
    let options = {};
    process.argv.filter((argument, index) => {
        const option = argument.match(/--(\w+)/)
        if(option)
            options[option[1]] = process.argv[index + 1];
        return argument
    });

    return options;
})();

 switch(process.argv[2]){
    case 'gen':
        if(!processedOptions.file)
            throw ("Missing postman collection");
        genMd(processedOptions.file, processedOptions);
        break;
}
