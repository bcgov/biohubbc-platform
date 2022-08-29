FROM debian:bullseye

# Read environment variables
ARG GEOSERVER_VERSION=2.21.1
ARG TZ=America/Vancouver

ENV GEOSERVER_HOME="/usr/share/geoserver"
ENV GEOSERVER_DATA_DIR="${GEOSERVER_HOME}/data_dir"

# Make home directory
RUN mkdir ${GEOSERVER_HOME}
RUN mkdir ${GEOSERVER_DATA_DIR}

# Set the time zone
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

# Install a smarter package manager
RUN apt-get update 
RUN apt-get -y install aptitude

WORKDIR ${GEOSERVER_HOME}

# Download GeoServer
RUN aptitude -y install wget
RUN wget https://sourceforge.net/projects/geoserver/files/GeoServer/$GEOSERVER_VERSION/geoserver-$GEOSERVER_VERSION-bin.zip/download

# Setup non-root user
ENV USER_ID=1001
ENV GROUP_ID=root
ENV USER=geoserver

RUN useradd -rm -d /home/$USER -s /bin/bash -g $GROUP_ID -G sudo -u $USER_ID $USER

# RUN groupadd -g $GROUP_ID $USER
# RUN useradd -m -u $USER_ID -g $GROUP_ID --system $USER
RUN chown -R $USER_ID:$GROUP_ID $GEOSERVER_HOME

# Install GeoServer
RUN aptitude -y install openjdk-11-jdk
RUN aptitude -y install unzip
RUN aptitude -y install vim
RUN unzip download
RUN rm download

# Copy local files to container
COPY . .

RUN chmod -R 777 ${GEOSERVER_HOME}

# RUN chown -R $USER_ID:$GROUP_ID $GEOSERVER_HOME

# Copy custom web.xml to appropriate folder
RUN cp settings/web.xml webapps/geoserver/WEB-INF/web.xml

# RUN aptitude -y install curl wait-for-it

# RUN chown -R $USER_ID:$GROUP_ID ${GEOSERVER_HOME}
# RUN chmod -R ug+rwx ${GEOSERVER_HOME}

# VOLUME ${GEOSERVER_HOME}

USER $USER

# Expose the GeoServer port
EXPOSE 8080

# Run
CMD sh bin/startup.sh 
