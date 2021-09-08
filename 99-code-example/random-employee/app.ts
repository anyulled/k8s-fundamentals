import fs from "fs/promises";
import express from "express";
import { employeeRouter } from "./routes";
import config from "./config";
import { delay } from "./helpers";

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/employees", employeeRouter);

app.get("/health", (_, res) => {
  res.status(200).json("ok");
});

let variable = 'not called'

process.on('SIGTERM', () => {
  console.log('variable value', variable);
});

app.get("/shutdown", async (_, res) => {
  // TODO: Investigate why this is not called.
  variable = 'called';
  res.send('closing');
});

// TODO: Create file for readiness probe
(async () => {
  await delay(+config.system.delayStartup);

  app.listen(config.http.port, async () => {
    console.log(`Application running on ${config.http.port}`);
    await fs.writeFile(
      `${__dirname}/service-ready`,
      JSON.stringify(process.resourceUsage())
    );
  });
})();
