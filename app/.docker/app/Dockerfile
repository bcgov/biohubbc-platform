FROM node:16.13.0-alpine

RUN apk update && apk add python2 make g++

ENV HOME=/opt/app-root/src

RUN mkdir -p $HOME

WORKDIR $HOME

ENV PATH $HOME/node_modules/.bin:$PATH

# Copy the package files only
COPY package*.json ./

RUN npm install --legacy-peer-deps --only=production

# ENV PATH ${HOME}/node_modules/.bin/:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:$PATH

# Copy the rest of the files
COPY . ./

VOLUME ${HOME}

# start app with live reload
CMD ["npm", "run", "start"]
