FROM node:16-slim

# Install additional packages needed to use node 16 that aren't part of the 'slim' image
RUN apt-get update -y
RUN apt-get install -y g++ make python2

ENV HOME=/opt/app-root/src

RUN mkdir -p $HOME

WORKDIR $HOME

# Copy the package files only
COPY package*.json ./

# Install packages
RUN npm install

# Copy the rest of the files
COPY . .

VOLUME ${HOME}

# start api with live reload
CMD ["npm", "run", "start-reload"]
