FROM node:8-alpine
MAINTAINER reruin


WORKDIR /usr/src/sharelist-proxy

COPY . ./

ENV NODE_ENV production
ENV t=$t
ENV a=$a

RUN npm install --production

EXPOSE 33009

ENTRYPOINT ['node','index.js','-t $t','-h $h']