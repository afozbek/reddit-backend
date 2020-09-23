import "reflect-metadata";

import express from "express";
import Redis from "ioredis";
import session from "express-session";
import connectRedis from "connect-redis";

import { ApolloServer } from "apollo-server-express";
import { buildSchema } from "type-graphql";
import { HelloResolver } from "./resolvers/hello";
import { PostResolver } from "./resolvers/post";
import { UserResolver } from "./resolvers/user";

import { createConnection } from "typeorm";

import { __prod__, __SESSION_COOKIE_NAME__ } from "./constants";

import cors from "cors";
import { Post } from "./entities/Post";
import { User } from "./entities/User";
import path from "path";

require("dotenv").config();

const main = async () => {
  const conn = await createConnection({
    type: "postgres",
    database: "reddit2",
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    logging: true,
    synchronize: true,
    migrations: [path.join(__dirname, "./migrations/*")],
    entities: [Post, User],
  });

  await conn.runMigrations();

  const app = express();

  app.use(
    cors({
      origin: "http://localhost:3000",
      credentials: true,
    })
  );

  const RedisStore = connectRedis(session);
  const redis = new Redis();

  app.use(
    session({
      name: __SESSION_COOKIE_NAME__,
      store: new RedisStore({
        client: redis,
        disableTouch: true,
      }),
      cookie: {
        maxAge: 1000 * 60 * 60 * 24 * 365, // 1 year,
        httpOnly: true,
        secure: __prod__, // cookie only works https
        sameSite: "lax", //csrf
      },
      saveUninitialized: false,
      secret: process.env.SESSION_SECRET || "",
      resave: false,
    })
  );

  const apolloServer = new ApolloServer({
    schema: await buildSchema({
      resolvers: [HelloResolver, PostResolver, UserResolver],
      validate: false,
    }),
    context: ({ req, res }) => ({ req, res, redis }),
  });

  apolloServer.applyMiddleware({
    app,
    cors: false,
  });

  app.listen(8080, () => {
    console.log("Server is listening on 8080");
  });
};

main().catch((err) => {
  console.log(err);
});
