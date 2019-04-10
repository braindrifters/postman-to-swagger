# @drifters/postman-to-swagger 1.0.1

util to generate swagger file from a given postman collection


## Prerequisite

- node >= 6.9.1
- npm ^3.10.10

## Available Commands

## Installation
##### You can install package either globally or locally

    npm install @drifters/postman-to-swagger -g

##### generate the swagger file from a given postman collection

     
     
    swagger-gen gen --baseUrl localhost:5005 --basePath /api/v1 --file swagger-exp-urp.postman_collection.json

## Options

   + ***baseUrl*** : the baseUrl to be used
   + ***basePath*** : the basePath to be used
   + ***file***: the path to postman collection
   
## Roadmap
   + add test case
   + update to es6 format
   
## Authors
- suminksudhi



## License
MIT
