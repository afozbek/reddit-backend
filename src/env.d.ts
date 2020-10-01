declare namespace NodeJS {
  export interface ProcessEnv {
    SESSION_SECRET: string;
    TEST_EMAIL_USER: string;
    TEST_EMAIL_PASS: string;
    DATABASE_URL: string;
    REDIS_URL: string;
    PORT: string;
    CORS_ORIGIN: string;
  }
}
