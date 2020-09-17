import { MikroORM } from "@mikro-orm/core";
import path from "path";
import {
  __DATABASE_TYPE__,
  __DB_PASSWORD__,
  __DB_USER__,
  __prod__,
} from "./constants";
import { Post } from "./entities/Post";

export default {
  dbName: "reddit",
  entities: [Post],
  migrations: {
    path: path.join(__dirname, "./migrations"), // path to the folder with migrations
    pattern: /^[\w-]+\d+\.[tj]s$/, // regex pattern for the migration files
  },
  type: __DATABASE_TYPE__,
  user: __DB_USER__,
  password: __DB_PASSWORD__,
  debug: !__prod__,
} as Parameters<typeof MikroORM.init>[0];
// To initialize the type that init accepts
