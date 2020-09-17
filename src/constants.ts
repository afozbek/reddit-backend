require("dotenv").config();

export const __prod__ = process.env.NODE_ENV !== "production";
export const __POSTGRE_PASSWORD__ = process.env.POSTGRE_PASSWORD;
