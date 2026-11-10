FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

RUN npx prisma contract emit

EXPOSE 3000

CMD ["npm", "run", "dev:server"]
