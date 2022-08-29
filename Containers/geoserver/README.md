# GeoServer Folders

`./biohub-geoserver`: contains a custom Docker implementation of GeoServer (inspired by https://github.com/bcgov/geodock)

`./gs-geoserver`: is a copy of an existing Docker implementation of GeoServer (taken, and modified, from https://github.com/geoserver/docker).

Both versions of the base geoserver image can be built in OpenShift from the steps below. See [Creating Base GeoServer Image in OpenShift](#creating-base-geoserver-image-in-openshift)

_Note: Another popular option not included here is: https://github.com/kartoza/docker-geoserver_

# Creating Base GeoServer Image in OpenShift

_Note: All of these steps should be done in the OpenShift Tools Project (ie: `a0ec71-tools`)_

## 1. Create Template

### 1.1. Verify Template

- Ensure the environment values in `geoserver.bc.yaml` specify the correct values.
  - In particular, the variables related to the repo url/ref, context/dockerfile paths, and version.

### 1.2. Upload Template to OpenShift

- In the top right corner of the OpenShift UI, there is a circular plus button `(+)`.
- Click it and paste the template into the upload window.
- If there are any glaring errors, it will prompt you to address them.
- Click `Create`.

## 2. Create BuildConfig

### 2.1. Generate a BuildConfig from the Template

- In a compatible cli, where you have logged into the OpenShift CLI, execute the following:
- ```
  oc process <template name> | oc create -f -
  ```
  - `process` converts the template into its JSON representation
  - `create` generates the appropriate OpenShift artifacts based on the templates content
- You should be able to see your new build config under the `Builds -> BuildConfigs` section of OpenShift

### 2.2. Modify the BuildConfig (if needed)

- You can still make modifications to the BuildConfig at this stage.
  - Click on your build config (under `Builds -> BuildConfigs`)
  - Under the `Actions` drop down, click `Edit BuildConfig`.
    - You can edit it via a Form view or YAML view.

## 3. Create ImageStream

### 3.1. Run the BuildConfig

- From the build config page, under the `Actions` drop down, click `Start Build`.
  - This will generate a new item under `Builds -> Builds`, which will in turn create a new item under the `Builds -> ImageStreams`.
    - Keep an eye on the build logs to ensure it builds correctly. This may take several minutes.

# Finding Existing Templates

- Templates can be found via the `Home -> API Explorer` page.
- Filter `All groups` to `template.openshift.io`.
- Click `Template` from the list of results`.
- Click `Instances` from the subsequent page.
- From here you can view, edit, delete the template uploaded in the previous step.
