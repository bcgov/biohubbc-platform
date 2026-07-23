{{/*
Expand the name of the chart
*/}}
{{- define "app.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Namespace
*/}}
{{- define "environment.namespace" -}}
{{- printf "%s-%s" .Values.environment.licensePlate .Values.environment.name }}
{{- end }}

{{/*
Create app suffix
If environment.id is "deploy" AND environment.name is "dev", the value should be "-dev-deploy"
If environment.id is "deploy" AND environment.name is not "dev", the value should be "-ENV"
If environment.id is not "deploy", the value should be "-dev-1234"
*/}}
{{- define "app.suffix" -}}
{{- if and .Values.environment.id (eq (toString .Values.environment.id) "deploy") (eq .Values.environment.name "dev") }}
{{- printf "-%s-%s" .Values.environment.name (toString .Values.environment.id) | trunc 63 | trimSuffix "-" }}
{{- else if and .Values.environment.id (eq (toString .Values.environment.id) "deploy") (ne .Values.environment.name "dev") }}
{{- printf "-%s" .Values.environment.name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "-%s-%s" .Values.environment.name .Values.environment.changeId | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}

{{/*
Create a default fully qualified app name
We truncate at 63 chars because some Kubernetes name fields are limited to this (by the DNS naming spec).
*/}}
{{- define "app.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s%s" .Values.app.name (include "app.suffix" .) | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label
*/}}
{{- define "app.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "app.labels" -}}
app: {{ include "app.fullname" . }}
app-name: {{ .Values.app.name }}
env-id: {{ .Values.environment.id | quote }}
env-name: {{ .Values.environment.name | quote }}
env-ts: {{ .Values.environment.ts | quote }}
helm.sh/chart: {{ include "app.chart" . }}
{{ include "app.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Common annotations
*/}}
{{- define "app.annotations" -}}
meta.helm.sh/release-name: {{ .Release.Name | quote }}
meta.helm.sh/release-namespace: {{ include "environment.namespace" . }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "app.selectorLabels" -}}
app.kubernetes.io/name: {{ include "app.name" . }}
app.kubernetes.io/instance: {{ .Values.environment.changeId | quote }}
{{- end }}

{{/*
DB Host
*/}}
{{- define "dbHost" -}}
biohub-platform-db{{ include "app.suffix" . }}
{{- end }}

{{/*
Image tag (tile gateway). Matches the tag pushed by the deploy workflows.
*/}}
{{- define "app.imageTag" -}}
{{- if and .Values.environment.id (eq (toString .Values.environment.id) "deploy") }}
{{- printf "build-%s-%s-%s" .Chart.AppVersion .Values.environment.changeId .Values.environment.name }}
{{- else }}
{{- printf "build-%s-%s" .Chart.AppVersion .Values.environment.changeId }}
{{- end }}
{{- end }}

{{/*
Tiles route host.

The tile gateway is exposed as a PATH on the app's own hostname (/tiles), so tile requests are same
origin and no CORS preflight occurs. This must therefore resolve to exactly the same host the app
chart's Route uses - the fallback below mirrors `appHost` in infrastructure/app/templates/_helpers.tpl.
*/}}
{{- define "tilesRouteHost" -}}
{{- if .Values.route.host }}
{{- printf "%s" .Values.route.host }}
{{- else }}
{{- /* toString guards against a numeric changeId, which would otherwise render as %!s(int64=...) */ -}}
{{- printf "biohub-platform-app-%s-%s-%s.apps.silver.devops.gov.bc.ca" (toString .Values.environment.changeId) .Values.environment.licensePlate .Values.environment.name }}
{{- end }}
{{- end }}
