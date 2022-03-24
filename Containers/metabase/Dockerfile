FROM centos:7

ARG TZ=America/Vancouver

RUN groupadd --system metabase && \
    useradd --system -g metabase --no-create-home metabase &&\
    mkdir -p /opt/metabase && \
    touch /var/log/metabase.log && \
    touch /etc/default/metabase

RUN chown -R metabase:metabase /opt/metabase && \
    chown metabase:metabase /var/log/metabase.log  && \
    chmod 640 /etc/default/metabase

WORKDIR /opt/metabase
ENV FC_LANG=en-US \
    LC_CTYPE=en_US.UTF-8

RUN yum -y update
RUN yum install java-11-openjdk-devel -y
RUN echo ':msg,contains,"metabase" /var/log/metabase.log & stop' >> /etc/rsyslog.d/metabase.conf

RUN yum install -y bash wget ttf-dejavu fontconfig
RUN wget -q https://downloads.metabase.com/latest/metabase.jar
RUN chown -R metabase:metabase /opt/metabase

# set time zone
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

EXPOSE 3000
ENTRYPOINT ["java", "-jar", "metabase.jar"]
