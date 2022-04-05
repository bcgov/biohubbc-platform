# Create github-cicd Account and Role Binding

We use this account to run OpenShift commands from GitHub Actions. it gets bound to dev,test, tools and prod.

Run: 
```
EXPORT NAMESPACE='a0ec71'
oc process -f github-cicd.yaml | oc create -f -
```
