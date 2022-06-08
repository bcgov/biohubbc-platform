# Metabase

This folder contains the OpenShift templates required in order to build and deploy an instance of Metabase onto OpenShift. These templates were designed with the assumption that you will be building and deploying the Metabase application within the same project. We will be running with the assumption that this Metabase instance will be co-located in the same project as the database it is expecting to poll from.

## Build Metabase

We'll retrieve/use the official docker image from the Artifactory, this will ensure us a current version of metabase for our purposes.
In order to make this work, you have to link your artifactory pull secret (found in the tools area) to you default and builder service accounts:
```
oc secrets link default artifacts-pull-default-<unique id> --for=pull
oc secrets link builder artifacts-pull-default-<unique id> --for=pull
```

## Deploy Metabase

Since the metabase image has already been built, you can then deploy it in your project by using the following command (replace anything in angle brackets with the correct value):

``` sh
export ADMIN_EMAIL=<ADMIN_EMAIL>
export NAMESPACE=<YOURNAMESPACE> (the license plate like af2668)
export TARGET_NS=<TARGET> (The area where metabase will be installed like dev, test, prod, tools)


oc process -n "$NAMESPACE-$TARGET_NS" -f metabase.dc.yaml ADMIN_EMAIL=$ADMIN_EMAIL NAMESPACE=$NAMESPACE TARGET_NS=$TARGET_NS -o yaml | oc apply -n $NAMESPACE -f -
```

This will create a new Secret, Service, Route, Persistent Volume Claim, and Deployment Configuration. This Deployment Config has liveliness and readiness checks built in, and handles image updates via Recreation strategy.

The Deployment yaml will also instantiate a PostgreSql database and connects it to Metabase.

## Initial Setup

Once Metabase is up and functional (this will take between 3 to 5 minutes), you will have to do initial setup manually. We suggest you populate the email account and password as whatever the `metabase-secret` secret contains in the `admin-email` and `admin-password` fields respectively. You may be asked to connect to your existing Postgres (or equivalent) database during this time, so you will need to refer to your other secrets or other deployment secrets in order to ensure Metabase can properly connect to it via JDBC connection.

## Notes

In general, Metabase should generally take up very little CPU (<0.01 cores) and float between 700 to 800mb of memory usage during operation. The template has some reasonable requests and limits set for both CPU and Memory, but you may change it should your needs be different.

## Connecting to databases in other target areas

It is possible to connect Metabase in one target areas (like tools) to databases in dev,test or even prod.

For that we need to create a NetworkPolicy in the area where the database is installed.
In the example below, we have metabase in tools wanting to connect to our database in dev.
We created our database with a label 'role: db' (you have to find a label that unique identifies your database) and for metabase you just have to fill in your namespace and environment.

```
kind: NetworkPolicy
apiVersion: networking.k8s.io/v1
metadata:
  name: metabase-to-db
spec:
  podSelector:
    matchLabels:
      role: db
  ingress:
    - ports:
        - protocol: TCP
          port: 5432
      from:
        - namespaceSelector:
            matchLabels:
              environment: tools
              name: af2668
        - podSelector:
            matchLabels:
              app: metabase
  policyTypes:
    - Ingress
```
### To connect Metabase to your database

In the Database connection screen refer to your database server with the namespace suffixed.
So in the example above our database server is called: 
**biohubbc-db-postgresql-dev-deploy** and in metabase we refer to it as: 
**biohubbc-db-postgresql-dev-deploy.af2668-dev**
