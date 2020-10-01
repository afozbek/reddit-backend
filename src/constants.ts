require("dotenv").config();

export const __prod__ = process.env.NODE_ENV === "production";
export const __SESSION_COOKIE_NAME__ = "qid";
export const __FORGET_PASSWORD_PREFIX__ = "forget-password:";
