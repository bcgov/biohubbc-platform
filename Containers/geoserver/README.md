# GeoServer

`./kartoza-geoserver`: contains OpenShift templates for building a GeoServer build config and image stream.  
`./kartoza-geoserver/geoserver.cm.yaml`: an OpenShift config map template.  
`./kartoza-geoserver/geoserver.bc.yaml`: an OpenShift build config template.  
`./kartoza-geoserver/geoserver.dc.yaml`: an OpenShift deployment config template.

The base kartoza geoserver image can be built in OpenShift from the steps below. See [Creating Base GeoServer Image in OpenShift](#creating-base-geoserver-image-in-openshift)

# Create Base GeoServer Image In OpenShift

_Note: All of these steps should be done in the OpenShift Tools Project (ie: `a0ec71-tools`)_

## 1. Upload Templates

### 1.1 Upload ConfigMap Template

- Ensure the environment values in `geoserver.cm.yaml` specify the correct values.
  - These can be easily changed after the template is uploaded, but should be persisted in `geoserver.cm.yaml` for backup.
- Follow the steps in [How to Upload a Template](#how-to-upload-a-template).
- This will automatically create a new ConfigMap (no template processing needed)

_Note: This config map is simply a placeholder for the env vars. To make them accessible by the build config, you still need to include an entry in the `env` section of `geoserver.bc.yaml` for each variable. Similar to how secrets are added as variables to build/deployment configs._

### 1.2. Upload BuildConfig Template

- Ensure the environment values in `geoserver.bc.yaml` specify the correct values.
  - In particular, the variables related to the repo url/ref, context/dockerfile paths, and version.
- Follow the steps in [How to Upload a Template](#how-to-upload-a-template).

## 2. Process The BuildConfig Template

- See [Process A Template](#process-a-template)

### 3. Run The BuildConfig

### 3.1 Modify The BuildConfig (If Temporary Changes Are Needed)

- You can still make modifications to the BuildConfig at this stage.
  - Click on your build config (under `Builds -> BuildConfigs`)
  - Under the `Actions` drop down, click `Edit BuildConfig`.
    - You can edit it via a Form view or YAML view.

_Note: Any modifications that are not intended to be temporary should be persisted in `geoserver.cm.yaml` for backup._

### 3.2. Run The BuildConfig

- From the build config page, under the `Actions` drop down, click `Start Build`.
  - This will generate a new item under `Builds -> Builds`, which will in turn create a new item under the `Builds -> ImageStreams`.
    - Keep an eye on the build logs to ensure it builds correctly. This may take several minutes.
      - If successful, it will finish with a log message like: `Successfully pushed image-registry.openshift-image-registry ...`

# Deploy GeoServer Image In OpenShift

_Note: All of these steps should be done in the OpenShift Dev/Test/Prod Project (ie: a0ec71-dev)_

## 1. Upload DeploymentConfig Template

- Ensure the environment values in `geoserver.dc.yaml` specify the correct values.
- Follow the steps in [How to Upload a Template](#how-to-upload-a-template).

## 2. Process The DeploymentConfig Template

- See [Process A Template](#process-a-template)

## 3. Run the DeploymentConfig

- From the build config page, under the `Actions` drop down, click `Start Build`.
  - This will generate a new item under `Builds -> Builds`, which will in turn create a new item under the `Builds -> ImageStreams`.
    - Keep an eye on the build logs to ensure it builds correctly. This may take several minutes.
      - If successful, it will finish with a log message like: `Successfully pushed image-registry.openshift-image-registry ...`

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

  _Note: See [Template OC Commands](#template-oc-commands) for details._

# Template OC Commands

- Process a template, creating/replacing any OpenShift artifacts specified in the template.
  ```
  oc process <template name> | oc [create|replace] -f -
  ```
  - `process` converts the template into its JSON representation
  - `create` generates the appropriate OpenShift artifacts based on the templates content
  - `replace` generates the appropriate OpenShift artifacts based on the templates content, replacing any existing artifacts of the same name.
