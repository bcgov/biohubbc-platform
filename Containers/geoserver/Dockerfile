FROM debian:bullseye

# Read environment variables
ARG GEOSERVER_VERSION=2.21.1
ARG TZ=America/Vancouver

# Set the time zone
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

# Install a smarter package manager
RUN apt-get update 
RUN apt-get -y install aptitude

# Download Geoserver
RUN mkdir /usr/share/geoserver
WORKDIR /usr/share/geoserver
RUN aptitude -y install wget
RUN wget https://sourceforge.net/projects/geoserver/files/GeoServer/$GEOSERVER_VERSION/geoserver-$GEOSERVER_VERSION-bin.zip/download

# Install Geoserver
RUN aptitude -y install openjdk-11-jdk
RUN aptitude -y install unzip
RUN unzip download
RUN rm download

# This is for configuring Geoserver
COPY . ./
RUN chmod -R 777 /usr/share/geoserver
RUN cp settings/web.xml webapps/geoserver/WEB-INF/
RUN aptitude -y install curl wait-for-it

# Expose the Geoserver port
EXPOSE 8080

# Run
ENTRYPOINT wait-for-it localhost:8080
