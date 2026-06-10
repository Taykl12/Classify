import cors from "cors";
import express from "express";
import { config } from "./config.js";
import authRouter from "./routes/auth.js";
import projectsRouter from "./routes/projects.js";
import dashboardRouter from "./routes/dashboard.js";
import usersRouter from "./routes/users.js";
import profileRouter from "./routes/profile.js";

export function createApp() {
  const app = express();
  app.use(
    cors({
      origin: config.appOrigin,
      credentials: true,
    })
  );
  app.use(express.json());

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, service: "classify-api" });
  });

  app.use("/api/auth", authRouter);
  app.use("/api/projects", projectsRouter);
  app.use("/api/dashboard", dashboardRouter);
  app.use("/api/users", usersRouter);
  app.use("/api/profile", profileRouter);

  return app;
}
