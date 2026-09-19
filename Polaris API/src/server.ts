import { buildApp } from "./app.js";
import { loadConfig } from "./config.js";

const config = loadConfig();
const app = await buildApp({ config });

try {
  await app.listen({ port: config.port, host: config.host });
  app.log.info({ port: config.port, host: config.host }, "Polaris API listening");
} catch (error) {
  app.log.error(error, "Polaris API failed to start");
  process.exitCode = 1;
}
