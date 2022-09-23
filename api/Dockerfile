# ################################# W A R N I N G ####################################################################
# This DockerFile is used for deployments only, please do not change for other purposes. It will break our deployment.
# ####################################################################################################################

FROM node:16.13.0-alpine

RUN apk update && apk add python2 make g++

ENV HOME=/opt/app-root/src

RUN mkdir -p $HOME

WORKDIR $HOME

ENV PATH $HOME/node_modules/.bin:$PATH
# ENV PATH /opt/rh/rh-nodejs8/root/usr/bin:${HOME}/node_modules/.bin/:${HOME}/app.npm-global/bin/:${HOME}/bin:${HOME}/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

# Copy the package files only
COPY ./package*.json ./

RUN npm install

# Copy the rest of the files
COPY . ./

# Cleaning any existing generated file
RUN rm -rf ./dist

# Build api
RUN npm run build

# Application VOLUME
VOLUME ${HOME}

EXPOSE 6100

# Application Entry point
CMD ["npm", "run", "start"]
