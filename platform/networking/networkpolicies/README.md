# Create APP/API/DB Network Policies in dev/test and prod

Pods within OpenShift cannot communicate with other pods by default. You must create `NetworkPolicies` to allow them to
interact with one another.

Network Policy selectors can be specific (ie: pods with this specific name) or general (ie: all pods in this namespace).

### Usage Example

For your API pod to read/write to the Database pod, a network policy must exist
that grants the API pods permission to interface with teh Database pod.

## Network Policy Templates

### Create specific network policies for each paid of pods that should be allowed to communicate:

```
EXPORT NAMESPACE='a0ec71'
oc process -f app-to-api-to-db.yaml | oc create -f -
```

### Create blanket network policies that allow all pods in the namespace to communicate to all other pods in the namespace.

```
EXPORT NAMESPACE='a0ec71'
oc process -f allowsamenamespace.yaml | oc create -f -
```

_Note: This is easier to configure, as you don't need to know what specific pods need to communicate, but also grants
blanket access between all pods, which may not be what you want if you wish to keep a tighter grip on pod security_
