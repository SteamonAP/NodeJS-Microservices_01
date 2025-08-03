#node image 18v with alpine linux an base image
FROM node:18-alpine 

WORKDIR /use/src/app

COPY package*.json ./

RUN npm ci --only=production

COPY . .

EXPOSE 3004

CMD [ "node","src/server.js" ]
