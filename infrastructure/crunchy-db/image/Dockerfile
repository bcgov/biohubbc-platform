# ########################################################################################################
# Crunchy Postgres GIS image with the pg_roaringbitmap extension, for the DEV/TEST/PROD Crunchy clusters.
# Built and pushed to the tools namespace by .github/workflows/buildPostgresImage.yml; the tag it is
# pushed under is `crunchyImage` in infrastructure/crunchy-db/values.yaml.
#
# The extension comes from the PGDG RHEL 9 build, whose files are copied into the Crunchy image's
# /usr/pgsql-<major> tree. PG_MAJOR must match the major version of CRUNCHY_IMAGE, and
# ROARINGBITMAP_RPM_VERSION must exist for that major on download.postgresql.org. Its release must equal
# ROARINGBITMAP_VERSION in database/Dockerfile and database/.docker/db/Dockerfile, which build the same
# extension for PR-preview and local databases.
# ########################################################################################################

ARG CRUNCHY_IMAGE=artifacts.developer.gov.bc.ca/bcgov-docker-local/crunchy-postgres-gis:ubi9-18.1-3.6-20260910

FROM registry.access.redhat.com/ubi9/ubi:9.6 AS roaringbitmap

ARG PG_MAJOR=18
ARG ROARINGBITMAP_RPM_VERSION=1.3.0-2PGDG.rhel9.9

RUN dnf install -y --setopt=install_weak_deps=False cpio && dnf clean all

# rpm -K exits non-zero unless the package is signed by the imported PGDG key.
RUN rpm --import https://download.postgresql.org/pub/repos/yum/keys/PGDG-RPM-GPG-KEY-RHEL \
  && curl -fsSL -o /tmp/roaringbitmap.rpm \
    "https://download.postgresql.org/pub/repos/yum/${PG_MAJOR}/redhat/rhel-9-x86_64/pg_roaringbitmap_${PG_MAJOR}-${ROARINGBITMAP_RPM_VERSION}.x86_64.rpm" \
  && rpm -K /tmp/roaringbitmap.rpm \
  && mkdir /out \
  && cd /out \
  && rpm2cpio /tmp/roaringbitmap.rpm | cpio -idm

FROM ${CRUNCHY_IMAGE}

ARG PG_MAJOR=18

# The server loads extensions from these directories; PostGIS being there proves they are the live ones,
# so the copy below cannot land somewhere the server never reads.
RUN test -f /usr/pgsql-${PG_MAJOR}/share/extension/postgis.control \
  && test -d /usr/pgsql-${PG_MAJOR}/lib

COPY --from=roaringbitmap /out/usr/pgsql-${PG_MAJOR}/lib/ /usr/pgsql-${PG_MAJOR}/lib/
COPY --from=roaringbitmap /out/usr/pgsql-${PG_MAJOR}/share/extension/ /usr/pgsql-${PG_MAJOR}/share/extension/

RUN test -f /usr/pgsql-${PG_MAJOR}/lib/roaringbitmap.so \
  && test -f /usr/pgsql-${PG_MAJOR}/share/extension/roaringbitmap.control
