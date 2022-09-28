# GeoServer

Dockerized GeoServer comes from https://github.com/NickPhura/docker-geoserver which is a modified fork of https://github.com/kartoza/docker-geoserver

- Modifications were needed to make the original kartoza docker setup compatible with OpenShift, specifically due to how OpenShift controls users/permissions within its pods (containers).

The GeoServer project, and its documentation, can be found here: https://geoserver.org/

Description of the files:

`./kartoza-geoserver`: contains OpenShift templates for building a GeoServer build config and image stream.  
`./kartoza-geoserver/geoserver.cm.yaml`: an OpenShift config map template.  
`./kartoza-geoserver/geoserver.bc.yaml`: an OpenShift build config template.  
`./kartoza-geoserver/geoserver.dc.yaml`: an OpenShift deployment config template.

# Installation

The base geoserver image can be built in OpenShift from the steps below.

See steps `1` and `2` for initial installation.  
See step `3` for updates to an existing installation.

# 1. Create Base GeoServer Image In OpenShift

**_Note: All of these steps should be done in the OpenShift Tools Project (ie: `a0ec71-tools`)_**

## 1. Upload Templates

### 1.1 Upload ConfigMap (`geoserver.cm.yaml`) Template

- Ensure the environment values in `geoserver.cm.yaml` specify the correct values.
  - These can be easily changed after the template is uploaded, but should be persisted in `geoserver.cm.yaml` for backup.
- Follow the steps in [How to Upload a Template](#how-to-upload-a-template).
- This will automatically create a new ConfigMap (no template processing needed)

_Note: This config map is simply a placeholder for the env vars. To make them accessible by the build config, you still need to include an entry in the `env` section of `geoserver.bc.yaml` for each variable. Similar to how secrets are added as variables to build/deployment configs._

### 1.2. Upload BuildConfig (`geoserver.bc.yaml`) Template

- Ensure the environment values in `geoserver.bc.yaml` specify the correct values.
  - In particular, the variables related to the repo url/ref, context/dockerfile paths, and version.
- Follow the steps in [How to Upload a Template](#how-to-upload-a-template).

### 1.3. Upload Secret (`geoserver.secret.yaml`) Template

- Follow the steps in [How to Upload a Template](#how-to-upload-a-template).

_Note: This template includes no values for the secret keys (as they cannot be saved in the repo). See [Update Secret Values](#update-secret-values) for modifying the secret._

## 2. Update Secret Values

- Under `Workloads -> Secrets -> <name specified in secret template>`
  - Edit the secret, and enter a value for the secrets.

## 3. Process The BuildConfig Template

- See [Process A Template](#process-a-template)

### 4. Run The BuildConfig

### 4.1 Modify The BuildConfig (If Temporary Changes Are Needed)

- You can still make modifications to the BuildConfig at this stage.
  - Click on your build config (under `Builds -> BuildConfigs`)
  - Under the `Actions` drop down, click `Edit BuildConfig`.
    - You can edit it via a Form view or YAML view.

_Note: Any modifications that are not intended to be temporary should be persisted in `geoserver.cm.yaml` for backup._

### 4.2. Run The BuildConfig

- From the build config page, under the `Actions` drop down, click `Start Build`.
  - This will generate a new item under `Builds -> Builds`, which will in turn create a new item under the `Builds -> ImageStreams`.
    - Keep an eye on the build logs to ensure it builds correctly. This may take several minutes.
      - If successful, it will finish with a log message like: `Successfully pushed image-registry.openshift-image-registry ...`

# 2. Deploy GeoServer Image In OpenShift

**_Note: All of these steps should be done in the OpenShift Dev/Test/Prod Project (ie: a0ec71-dev)_**

## 1. Upload DeploymentConfig (`geoserver.dc.yaml`) Template

- Ensure the environment values in `geoserver.dc.yaml` specify the correct values.
- Follow the steps in [How to Upload a Template](#how-to-upload-a-template).

## 2. Process The DeploymentConfig Template

- See [Process A Template](#process-a-template)

## 3. Run the DeploymentConfig

- From the build config page, under the `Actions` drop down, click `Start Build`.
  - This will generate a new item under `Builds -> Builds`, which will in turn create a new item under the `Builds -> ImageStreams`.
    - Keep an eye on the build logs to ensure it builds correctly. This may take several minutes.
      - If successful, it will finish with a log message like: `Successfully pushed image-registry.openshift-image-registry ...`

# 3. Updating The Base Image In OpenShift And Re-Deploying

If there is a newer version of the geoserver project available, follow the below steps to update the base image and deploy the new version.

## 1. Generated An Updated Image

In the OpenShift Tools Project (ie: a0ec71-tools):

- See [Run the BuildConfig](#42-Run-The-BuildConfig)
- This will generate a new `Build` which if successful will update the `ImageStream` from the latest geoserver project code

## 2. Re-Tag the ImageStream

In the OpenShift Dev/Test/Prod Project (ie: a0ec71-dev):

- In a compatible cli, where you have logged into the OpenShift CLI, execute the following command:

  ```
  oc tag a0ec71-tools/kartoza-geoserver:latest a0ec71-dev/kartoza-geoserver:latest
  ```

This will update the ImageStream in the `<dev/test/prod>` environment to point to the latest version of the base ImageStream in the `tools` environment.

- Confirm by checking that the `sha` number matches in both ImageStreams.

This will also trigger an automatic re-deploy of the geoserver deployment config, which should roll out a new pod using the latest ImageStream tag.

# How To Upload A Template

- In the top right corner of the OpenShift UI, there is a circular plus button `(+)`.
- Click it and paste the template into the upload window.
- If there are any glaring errors, it will prompt you to address them.
- Click `Create`.

# Find An Existing Template

- Templates can be found via the `Home -> API Explorer` page.
- Filter `All groups` to `template.openshift.io`.
- Click `Template` from the list of results`.
- Click `Instances` from the subsequent page.
- From here you can view, edit, delete the template uploaded in the previous step.

# Process A Template

- In a compatible cli, where you have logged into the OpenShift CLI, execute the following command:

  ```
  oc process <template name> | oc [create|replace] -f -
  ```

  - `process` converts the template into its JSON representation
  - `create` generates the appropriate OpenShift artifacts based on the templates content
  - `replace` generates the appropriate OpenShift artifacts based on the templates content, replacing any existing artifacts of the same name.

# Tag An ImageStream

- In a compatible cli, where you have logged into the OpenShift CLI, execute the following command:

  ```
  oc tag <source namespace>/<source image stream>:<source tag> <target namespace>/<target image stream>:<target tag>
  ```
