FROM node:6-alpine
MAINTAINER Giorgio Regni <gr@scality.com>

ENV NO_PROXY localhost,127.0.0.1
ENV no_proxy localhost,127.0.0.1

EXPOSE 8000

COPY ./package.json ./package-lock.json /usr/src/app/

WORKDIR /usr/src/app

RUN apk add --update jq bash coreutils openssl lz4 cyrus-sasl\
    && apk add --virtual build-deps \
                         python \
                         build-base \
                         git  \
                         bsd-compat-headers \
    && npm install --production \
    && npm cache clear --force \
    && apk del build-deps \
    && rm -rf ~/.node-gyp \
    && rm -rf /tmp/npm-* \
    && rm -rf /var/cache/apk/*

COPY . /usr/src/app

VOLUME ["/usr/src/app/localData","/usr/src/app/localMetadata"]

ENTRYPOINT ["/usr/src/app/docker-entrypoint.sh"]

CMD [ "npm", "start" ]
