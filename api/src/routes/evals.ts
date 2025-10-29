import { Router } from "express";
import fs from "fs/promises";
import path from "path";

export const evalsRouter = Router();

evalsRouter.get("/", async (_req, res) => {
  const dir = path.resolve(__dirname, "../../fixtures/evals");
  const files = await fs.readdir(dir);
  const data = await Promise.all(
    files
      .filter((file) => file.endsWith(".json"))
      .map(async (file) => {
        const content = await fs.readFile(path.join(dir, file), "utf8");
        return JSON.parse(content);
      })
  );
  res.json({ results: data });
});
