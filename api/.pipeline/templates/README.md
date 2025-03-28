# OpenShift Templates

This folder contains yaml templates for the api builds, deployments, etc.

## Prerequisites For Deploying On OpenShift

### 1.

The pipeline code builds and deploys all pods/images/storage/etc needed to deploy the application. However, there are some secrets that cannot be automatically deployed (as they cannot be committed to GitHub). You must manually create and populate these secrets.

- Create Database Secret
- Create ObjectStore Secret

The included templates under `prereqs` can be imported via the "Import YAML" page in OpenShift.

### 2.

Import the base nodejs image.

Run the following commands against the tools environment.

```bash
# Image the node 20 image from the red hat catalog
oc import-image nodejs:20 --from=registry.redhat.io/rhel8/nodejs-20:1-73 --confirm

# Tag the image to latest, which is the version expected by the build/deployment templates.
oc tag nodejs:20 nodejs:latest
```
