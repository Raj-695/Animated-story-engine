import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";

const app = express();
const port = Number(process.env.PORT || 8080);
const root = path.dirname(fileURLToPath(import.meta.url));

app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(root, "public")));

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "animated-story-engine", version: "0.1.0" });
});

app.get("/api/status", (_req, res) => {
  res.json({
    ready: Boolean(process.env.FAL_KEY && process.env.FAL_VIDEO_MODEL),
    provider: "fal",
    configured: {
      falKey: Boolean(process.env.FAL_KEY),
      videoModel: Boolean(process.env.FAL_VIDEO_MODEL)
    },
    note: "Generation stays disabled until the provider key and a schema-verified video model are configured."
  });
});

app.post("/api/plan", (req, res) => {
  const { concept, duration = 10, style = "cinematic 2D animation" } = req.body || {};
  if (!concept || typeof concept !== "string" || concept.trim().length < 8) {
    return res.status(400).json({ error: "Add a story concept of at least 8 characters." });
  }
  if (Number(duration) !== 10) {
    return res.status(400).json({ error: "The first validation workflow is fixed to a 10-second test." });
  }
  res.json({
    status: "draft",
    approvalRequired: true,
    durationSeconds: 10,
    style,
    concept: concept.trim(),
    stages: [
      "Story beat and voiceover draft",
      "Scene and shot breakdown",
      "Character and environment consistency plan",
      "Visual and sound design review",
      "Generation after explicit approval"
    ],
    generationEnabled: false
  });
});

app.listen(port, "0.0.0.0", () => {
  console.log(`Animated Story Engine listening on ${port}`);
});
