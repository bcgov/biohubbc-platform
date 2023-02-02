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

RUN npm install

# Copy the rest of the files
COPY . .

# Build api
RUN npm run build

RUN rm -rf !dist

RUN mv dist/* .

EXPOSE 6100

# Application Entry point
CMD ["node", "start"]
