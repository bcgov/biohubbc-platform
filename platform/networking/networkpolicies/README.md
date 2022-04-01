# Create APP/API/DB Network Policies in dev/test and prod

This will allow our applications to function once we narrow down our access.

Run: 
```
EXPORT NAMESPACE='a0ec71'
oc process -f app-to-api-to-db.yaml | oc create -f -
```

# Allow all pods in the same namespace to talk to each other

This is a temporary set up meant for development and initial deployment, this will be removed once the application in in full production.

Run: 
```
EXPORT NAMESPACE='a0ec71'
oc process -f allowsamenamespace.yaml | oc create -f -
```
