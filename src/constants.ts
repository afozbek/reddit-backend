require("dotenv").config();

export const __prod__ = process.env.NODE_ENV === "production";
export const __DB_PASSWORD__ = process.env.DB_PASSWORD;
export const __DB_USER__ = process.env.DB_USER;
export const __DATABASE_TYPE__ = process.env.DATABASE_TYPE;
export const __SESSION_COOKIE_NAME__ = "qid";
export const __FORGET_PASSWORD_PREFIX__ = "forget-password:";
