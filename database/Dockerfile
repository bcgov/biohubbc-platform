# ########################################################################################################
# This DockerFile is used for Openshift deployments only.
# ########################################################################################################

ARG POSTGRES_VERSION=18-bookworm

FROM postgres:$POSTGRES_VERSION

# read env variables
ARG TZ=America/Vancouver
ARG POSTGIS_VERSION=3

ENV PORT=5432

# install postgis packages
RUN mkdir -p /opt/apps
RUN apt-get -qq update
RUN apt-get -qq install -y --no-install-recommends postgresql-$PG_MAJOR-postgis-$POSTGIS_VERSION
RUN apt-get -qq install -y --no-install-recommends postgresql-$PG_MAJOR-postgis-$POSTGIS_VERSION-scripts
RUN apt-get -qq install -y --no-install-recommends postgresql-$PG_MAJOR-pgrouting
RUN apt-get -qq install -y --no-install-recommends postgresql-$PG_MAJOR-pgrouting-scripts
RUN apt-get -qq install -y --no-install-recommends postgresql-$PG_MAJOR-roaringbitmap
RUN apt-get -qq install -y --no-install-recommends postgresql-server-dev-$PG_MAJOR
RUN apt-get -qq install -y --no-install-recommends pgbadger pg-activity wget unzip nano
# pg_roaringbitmap is built from source: the PGDG apt repository has no release of this version. Keep
# ROARINGBITMAP_VERSION equal to the version infrastructure/crunchy-db/image installs in DEV/TEST/PROD.
# with_llvm=no skips the JIT bitcode, which needs clang.
ARG ROARINGBITMAP_VERSION=1.3.0
ARG ROARINGBITMAP_SHA256=deacb72b1db57823b167ea828e8cea0beb5cec0aeb1205523d7aac47f7f9cf83
RUN apt-get -qq install -y --no-install-recommends build-essential ca-certificates wget \
  && wget -q -O /tmp/pg_roaringbitmap.tar.gz "https://github.com/ChenHuajun/pg_roaringbitmap/archive/refs/tags/v${ROARINGBITMAP_VERSION}.tar.gz" \
  && echo "${ROARINGBITMAP_SHA256}  /tmp/pg_roaringbitmap.tar.gz" | sha256sum -c - \
  && tar -xzf /tmp/pg_roaringbitmap.tar.gz -C /tmp \
  && make -C "/tmp/pg_roaringbitmap-${ROARINGBITMAP_VERSION}" with_llvm=no \
  && make -C "/tmp/pg_roaringbitmap-${ROARINGBITMAP_VERSION}" with_llvm=no install \
  && rm -rf /tmp/pg_roaringbitmap* \
  && apt-get -qq purge -y --auto-remove build-essential
RUN apt-get -qq purge -y --auto-remove postgresql-server-dev-$PG_MAJOR
RUN apt-get -qq autoremove -y
RUN apt-get -qq clean

# set time zone
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

# copy postgis init script to docker init directory
RUN mkdir -p /docker-entrypoint-initdb.d
COPY ./.docker/db/create_postgis.sql /docker-entrypoint-initdb.d/postgis.sql

EXPOSE $PORT

CMD ["postgres"]
