const pino = require("pino");

const level = process.env.LOG_LEVEL || "info";
const usePretty = process.env.PRETTY_LOGS !== "false";

const transport = usePretty
  ? pino.transport({
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "SYS:yyyy-mm-dd HH:MM:ss",
        ignore: "pid,hostname",
        singleLine: true,
      },
    })
  : undefined;

const logger = pino({ level }, transport);

module.exports = logger;
