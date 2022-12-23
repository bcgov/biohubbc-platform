FROM node:16-slim

RUN apt-get update -y
RUN apt-get install -y g++ make python2

ENV HOME=/opt/app-root/src

RUN mkdir -p $HOME

WORKDIR $HOME

# Copy the package files only
# A wildcard is used to ensure both package.json AND package-lock.json are copied where available (npm@5+)
COPY package*.json ./

# Install packages
RUN npm ci --legacy-peer-deps

ENV PATH ${HOME}/node_modules/.bin/:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:$PATH

# Copy the rest of the files
COPY . ./

VOLUME ${HOME}

# start app with live reload
CMD ["npm", "run", "start"]
