# Postman

Postman is a tool that allows you to make HTTP requests to some API, with UI support for path/query/body parameters, and pre/post request script execution, etc.

## Pre-reqs

- [Install Postman](https://www.postman.com/downloads/)

## Import Files

- Launch Postman
- File Import Folder
- Select the `./testing/integration/postman` folder.

## Select Environment

- In the drop-down at the top-right corner of the screen, select `BioHubBC-Service-Client-Environment-DEV`

## Edit The Environment

- In Postman, next to the drop-down, click the 3 dots menu.
- From the pop-up window, click the `BioHubBC-Service-Client-Environment-DEV` environment
- Edit the `Current Value` column for the following fields (depending on auth type):

### Common Env Vars

- API_BASE_URL

##### Example:

```
API_BASE_URL = localhost:6100/api
```

### Additional Env Vars

#### Authenticating as a user (default)

- KEYCLOAK_USER_NAME
- KEYCLOAK_USER_PASSWORD
- KEYCLOAK_AUTH_TYPE

##### Example:

```
KEYCLOAK_SERVICE_CLIENT_ID = testuser@idir
KEYCLOAK_SERVICE_CLIENT_PASSWORD = testuserpassword
KEYCLOAK_AUTH_TYPE = <leave blank>
```

#### Authenticating As A Service Client

_Note: A service client is a special keycloak client, and in this case is used in to facilitate system-to-system communication._

- KEYCLOAK_SERVICE_CLIENT_ID
- KEYCLOAK_SERVICE_CLIENT_PASSWORD
- KEYCLOAK_AUTH_TYPE=service

##### Example:

```
KEYCLOAK_SERVICE_CLIENT_ID = client-svc
KEYCLOAK_SERVICE_CLIENT_PASSWORD = clientsvcpassword
KEYCLOAK_AUTH_TYPE = service
```

# API Testing With Postman (POC)

Primary goal of postman tests is to run against our PR and Dev code.

## Running Tests

- Tests can be run within the Postman application either one by one or with the _Runner_ option, which allows for the complete suite to run.
- Tests can also run from the command line (and therefore the CI) with [Newman](https://learning.postman.com/docs/running-collections/using-newman-cli/command-line-integration-with-newman/)

# License

    Copyright 2020 Province of British Columbia

    Licensed under the Apache License, Version 2.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.
