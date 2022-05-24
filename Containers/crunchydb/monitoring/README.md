# Crunchy DB PGO Monitoring

You can install one Crunchy Monitoring stack in a tools namespace and monitor all your PGO clusters. In these directions replace `LICENSE` with the license plate of your namespaces.

## Prerequisite

You will need to install [Kustomize](https://kubectl.docs.kubernetes.io/installation/kustomize/) to be able to build the manifests from Crunchy.

## Install monitoring stack

Use this to install the Crunchy DB Monitoring stack into your tools namespace to monitor all your PGO instances.

Edit `kustomization.yaml` and set your tools namespace.

```yaml
namespace: a0ec71-tools
```

Edit `grafana-oauth.yaml` and set `CHANGEME` to your tools namespace.

```yaml
- '--openshift-sar={"namespace": "a0ec71-tools", "resource": "services", "verb": "get"}'
```

Build the manifest. Note that `oc apply -k` seems to not work here due to using an older version of Kustomize.

```bash
kustomize build . -o crunchy-monitoring.yaml
```

Edit the output manifest `crunchy-monitoring.yaml`.

First, find the ConfigMap for `alertmanager.yml` and set a better receiver for the alerts.

```yaml
    global:
        smtp_smarthost: "apps.smtp.gov.bc.ca:25"
        smtp_require_tls: false
        smtp_from: 'Alertmanager <real-address@gov.bc.ca>'
```

```yaml
    receivers:
    - name: 'default-receiver'
      email_configs:
      - to: 'your-team@gov.bc.ca'
        send_resolved: true
```

Then find the ConfigMap for `prometheus.yml` and add the namespaces you want to monitor.

```yaml
    scrape_configs:
    - job_name: 'crunchy-postgres-exporter'
      kubernetes_sd_configs:
      - role: pod
        namespaces:
          names:
            - a0ec71-tools
            - a0ec71-dev
            - a0ec71-test
            - a0ec71-prod
```

Finally, create all the items in the manifest.

```bash
oc -n a0ec71-tools create -f crunchy-monitoring.yaml
```

## Add monitoring sidecar to your PostgresCluster

Edit your `PostgresCluster` to include the monitoring container as a sidecar. Either directly with `oc edit` or edit your local kustomize files and then `oc intall -k`.

```yaml
spec:
  monitoring:
    pgmonitor:
      exporter:
        image: registry.developers.crunchydata.com/crunchydata/crunchy-postgres-exporter:ubi8-5.0.4-0
```

Add a `Role` and `RoleBinding` to the namespace where your PGO cluster is to allow access from your tools namespace where you installed the monitoring.

```yaml
---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  labels:
    app.kubernetes.io/name: postgres-operator-monitoring
    vendor: crunchydata
  name: crunchy-monitoring
rules:
- apiGroups:
  - ""
  resources:
  - pods
  verbs:
  - get
  - list
  - watch
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  labels:
    vendor: crunchydata
  name: crunchy-monitoring
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: Role
  name: crunchy-monitoring
subjects:
- kind: ServiceAccount
  name: prometheus-sa
  namespace: a0ec71-tools
```

Add a NetworkPolicy to allow the monitor to connect to your pods. Make sure `biohub` is changed to your `PostgresCluster` name.

```yaml
kind: NetworkPolicy
apiVersion: networking.k8s.io/v1
metadata:
  name: allow-crunchydb-monitoring
  labels:
    postgres-operator.crunchydata.com/cluster: biohub
spec:
  podSelector:
    matchLabels:
      postgres-operator.crunchydata.com/cluster: biohub
  ingress:
    - from:
        - namespaceSelector:
            name: LICENSE
            environment: tools
      ports:
        - protocol: TCP
          port: 9187
```
