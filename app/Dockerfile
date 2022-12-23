# ################################# W A R N I N G ####################################################################
# This DockerFile is used for deployments only, please do not change for other purposes. It will break our deployment.
# ####################################################################################################################

FROM node:16-slim

# Install additional packages needed to use node 16 that aren't part of the 'slim' image
RUN apt-get update -y
RUN apt-get install -y g++ make python2

ENV HOME=/opt/app-root/src

RUN mkdir -p $HOME

WORKDIR $HOME

# Copy the package files only
COPY ./package*.json ./

RUN npm install --legacy-peer-deps

# ENV PATH /opt/rh/rh-nodejs8/root/usr/bin:${HOME}/node_modules/.bin/:${HOME}/app.npm-global/bin/:${HOME}/bin:${HOME}/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

# Copy the rest of the files
COPY . .

# Build app
RUN npm run build

EXPOSE 7100

# RUN APP
CMD ["npm", "run", "deploy_start"]
