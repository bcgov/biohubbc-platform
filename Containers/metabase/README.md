### Table of Contents

- [NRM MetaBase](#nrm-metabase)
  - [Prerequisites](#prerequisites)
  - [Files](#files)
  - [Build](#build)
    - [Custom Image](#custom-image)
  - [Deploy](#deploy)
    - [Database Deployment](#database-deployment)
    - [Application Deployment](#application-deployment)
      - [Initialize MetaBase installation](#initialize-metabase-installation)
  - [Using Environmental variables to deploy](#using-environmental-variables-to-deploy)
    - [Set the environment variables](#set-the-environment-variables)
    - [Build](#build-1)
    - [Database Deployment](#database-deployment-1)
    - [Application Deployment](#application-deployment-1)
      - [Log into the MetaBase app](#log-into-the-metabase-app)
  - [FAQ](#faq)
  - [TODO](#todo)

# NRM MetaBase

Templates for deployment of [MetaBase](https://github.com/metabase/metabase), used within Natural Resources Ministries and ready for deployment on [OpenShift](https://www.openshift.com/). [MetaBase](https://www.metabase.com/) is an open-source [Clojure](https://clojure.org/) / [JavaScript](https://developer.mozilla.org/en-US/docs/Web/JavaScript) application with a [PostgreSQL](https://www.postgresql.org/) relational database for persistent data.

## Prerequisites

Network Security Policy is in place, for example:

```bash
oc -n 599f0a-dev process -f https://raw.githubusercontent.com/BCDevOps/platform-services/master/security/aporeto/docs/sample/quickstart-nsp.yaml NAMESPACE=599f0a-dev | oc -n 599f0a-dev create -f -
```

Secret exists to allow pull from DockerHub, for example:
```bash
oc -n 245e18-tools create secret docker-registry docker-pull-passthru \
    --docker-server=docker-remote.artifacts.developer.gov.bc.ca \
    --docker-username=default-245e18-xxxxxx \
    --docker-password=xxxxxx \
    --docker-email=default-245e18-ujotfv@245e18-tools.local

oc -n 245e18-tools secrets link default docker-pull-passthru
oc -n 245e18-tools secrets link builder docker-pull-passthru

```


For builds:

- Administrator access to an [Openshift](https://console.apps.silver.devops.gov.bc.ca/k8s/cluster/projects) Project namespace

Once built, this image may be deployed to a separate namespace with the appropriate `system:image-puller` role.

For deployments:

- Administrator access to an [Openshift](https://console.apps.silver.devops.gov.bc.ca/k8s/cluster/projects) Project namespace
- the [oc](https://docs.openshift.com/container-platform/4.6/cli_reference/openshift_cli/getting-started-cli.html) CLI tool, installed on your local workstation
- access to this public [GitHub Repo](./)

Once deployed, any visitors to the site will require a modern web browser (e.g. Chrome, Edge, FF, Opera etc.).

## Files

- [OpenShift Metabase .bc template](/ci/openshift/metabase.bc.yaml) for Metabase image build
- [OpenShift Metabase .dc template](/ci/openshift/metabase.dc.yaml) for Metabase application deployment
- [OpenShift Database .dc template](/ci/openshift/postgresql.dc.yaml) for PostgreSQL Database deployment, acting as the datastore for the Metabase application


## Build

### Custom Image

Dockerfile, referencing `http://downloads.metabase.com/${METABASE_VERSION}/metabase.jar` where `${METABASE_VERSION}` is customizable.


For example:
```bash
oc process -n $TOOLS -f ./ci/openshift/metabase.bc.yaml -p METABASE_VERSION=$METABASE_VERSION -o yaml | oc apply -n $TOOLS -f -
```

## Deploy

### Database Deployment

Deploy the DB using the correct BI parameter (e.g. an acronym that is prefixed to `-metabase`):

```bash
> oc -n ${PROJECT} new-app --file=./ci/openshift/postgresql.dc.yaml -p NAME=${BI}-metabase
```

All DB deployments are based on the out-of-the-box [OpenShift Database Image](https://docs.openshift.com/container-platform/3.11/using_images/db_images/postgresql.html).


### Application Deployment

Deploy the Application specifying:

- the feedback-specific parameter (i.e. `${BI}-metabase`)
- your project namespace that contains the image, and
- your project namespace into which the app will be deployed, and
- a `@gov.bc.ca` email account that will be used with the `apps.smtp.gov.bc.ca` SMTP Email Server:

```bash
oc -n $PROJECT new-app --file=./ci/openshift/metabase.dc.yaml -p IS_NAMESPACE=${TOOLS} -p NAME=${BI}-metabase -p ADMIN_EMAIL=${ADMIN_EMAIL} -o yaml | oc apply -n ${PROJECT} -f -
```

#### Initialize MetaBase installation

Navigate the GUI to configure the initial configuration:

```bash
Database type: PostgreSQL
Host: ${BI}-metabase-postgresql
Database name: ${BI}-metabase
Usename: <from secret>
Password: <from secret>
```

Navigate the Adnin Menu (Admin -> Settings -> General)
```bash
Site URL: https://
${BI}-metabase.apps.silver.devops.go.bc.ca
```

```bash
SMTP HOST: apps.smtp.gov.bc.ca
SMTP PORT: 25
SMTP Security: None
From Address: 
```

```bash
LDAP HOST: idir.bcgov
LDAP PORT: 389
LDAP SECURITY: None
USER SEARCH BASE: OU=BCGOV,DC=idir,DC=bcgov
USER FILTER: (&(|(sAMAccountName={login})(mail={login})))
```


## Using Environmental variables to deploy

As this is a template deployment, it may be easier to set environment variable for the deployment, so using the same PROJECT of `245e18-dev` and a new BI project of `test`:

<details><summary>Deployment Steps</summary>

### Set the environment variables

On a workstation logged into the OpenShift Console:

```bash
export TOOLS=245e18-tools
export PROJECT=245e18-dev
export BI=test
export METABASE_VERSION=v0.39.4
```

### Build

```bash
oc process -n $TOOLS -f ./ci/openshift/metabase.bc.yaml -p METABASE_VERSION=$METABASE_VERSION -o yaml | oc apply -n $TOOLS -f -
```

### Database Deployment

```bash
oc -n ${PROJECT} new-app --file=./ci/openshift/postgresql.dc.yaml -p NAME=${BI}-metabase
```

```bash
--> Deploying template "245e18-dev/nrms-postgresql-dc" for "./ci/openshift/postgresql.dc.yaml" to project 245e18-dev

     * With parameters:
        * Service Name=test-metabase
        * Memory Limit=512Mi
        * PostgreSQL Connection Password=FmoBavwEMKkD11oS # generated
        * Database Volume Capacity=2Gi

--> Creating resources ...
    secret "test-metabase-postgresql" created
    persistentvolumeclaim "test-metabase-postgresql" created
    deploymentconfig.apps.openshift.io "test-metabase-postgresql" created
    service "test-metabase-postgresql" created
--> Success
    Application is not exposed. You can expose services to the outside world by executing one or more of the commands below:
     'oc expose service/test-metabase-postgresql' 
    Run 'oc status' to view your app.
```

### Application Deployment


```bash
export ADMIN_EMAIL=Gary.T.Wong@gov.bc.ca

oc -n $PROJECT new-app --file=./ci/openshift/metabase.dc.yaml -p IS_NAMESPACE=${TOOLS} -p NAME=${BI}-metabase -p ADMIN_EMAIL=${ADMIN_EMAIL} -o yaml | oc apply -n ${PROJECT} -f -
```

#### Log into the MetaBase app

After thirty seconds, you may navigate to the setup page at:
`${BI}-metabase.apps.silver.devops.go.bc.ca`

When finished, remember to unset the environment variables:

```bash
unset TOOLS PROJECT BI METABASE_VERSION ADMIN_EMAIL
```

</details>


## FAQ

- To login into the OpenShift database, start the DB pod terminal (via OpenShift Console or `oc rsh`) and enter:

```bash
psql -U ${POSTGRESQL_USER} ${POSTGRESQL_DATABASE}
```

- To clean-up database depoyments, when using environment variables:
```bash
  oc -n ${PROJECT} idle ${BI}-metabase-postgresql
  oc -n ${PROJECT} delete secret/${BI}-metabase-postgresql svc/${BI}-metabase-postgresql pvc/${BI}-metabase-postgresql dc/${BI}-metabase-postgresql
```

- To clean-up application depoyments, when using environment variables:
```bash
oc -n ${PROJECT} delete  secret/${BI}-metabase-secret svc/${BI}-metabase route/${BI}-metabase dc/${BI}-metabase
```

- For local environment, run `UID="$(id -u)" GID="$(id -g)" docker-compose up`

    To clean up local persistent data, `rm -rf postgresql/data/*`

    To log into local containerized database:
    ```bash
    docker-compose exec -u postgres db
    psql -U ${POSTGRES_USER} -d ${POSTGRES_DB}
    ```

## TODO

- test out LDAP settings
- check for image triggers which force a reploy (image tags.. latest -> v0.19.0)
