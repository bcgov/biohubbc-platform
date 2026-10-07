{{/* Chart-scoped names, shared by the CronJob and its pod labels. */}}
{{- define "materialized-view-refresh.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "materialized-view-refresh.fullname" -}}
{{- if .Values.fullnameOverride -}}
{{- .Values.fullnameOverride | trunc 52 | trimSuffix "-" -}}
{{- else -}}
{{- printf "%s-%s" .Release.Name (include "materialized-view-refresh.name" .) | trunc 52 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}
