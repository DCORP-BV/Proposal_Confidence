FROM node:latest

# Set working directory
RUN mkdir /app
WORKDIR /app

# A wildcard is used to ensure both package.json AND package-lock.json are copied
# where available (npm@5+)
COPY package*.json /app/

# Install app dependencies
RUN npm install --no-cache git

# Bundle app source
COPY . /app/

# compile the code, so running test will be faster
RUN npm run compile