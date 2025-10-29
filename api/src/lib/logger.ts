import pino from "pino";
import { isProduction } from "../config/env";

export const logger = pino({
  level: isProduction ? "info" : "debug",
  transport: isProduction
    ? undefined
    : {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "SYS:standard",
          singleLine: true
        }
      },
  redact: {
    paths: ["payload.pan", "payload.cardNumber", "cardNumber", "pan", "details.pan"],
    censor: "***REDACTED***"
  }
});
