import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID, timingSafeEqual } from "node:crypto";

const app = express();
const port = Number(process.env.PORT || 8080);
const root = path.dirname(fileURLToPath(import.meta.url));
const VIDEO_MODEL = process.env.FAL_VIDEO_MODEL || "minimax/h3-max/text-to-video";
const COST_PER_SECOND = Number(process.env.FAL_VIDEO_COST_PER_SECOND || 0.0375);

app.disable("x-powered-by");
app.use(express.json({ limit: "2mb" }));
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-Frame-Options", "DENY");
  next();
});
app.use(express.static(path.join(root, "public")));

const rateBuckets = new Map();
function rateLimit(req, res, next) {
  const key = req.ip || "unknown";
  const now = Date.now();
  const bucket = rateBuckets.get(key) || { start: now, count: 0 };
  if (now - bucket.start > 60_000) {
    bucket.start = now;
    bucket.count = 0;
  }
  bucket.count += 1;
  rateBuckets.set(key, bucket);
  if (bucket.count > 40) return res.status(429).json({ error: "Too many requests. Try again shortly." });
  next();
}
app.use("/api", rateLimit);

function clean(value, fallback, max = 500) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : fallback;
}
function makePlan(concept, style) {
  const id = randomUUID();
  const subject = concept.replace(/[.!?]+$/, "");
  return {
    planId: id,
    status: "draft",
    approvalRequired: true,
    durationSeconds: 10,
    format: { aspectRatio: "16:9", resolution: "768P", frameRate: 24 },
    concept: subject,
    logline: subject + ". A compact visual story with a clear setup, escalation and emotional payoff.",
    dramaticArc: [
      { time: "0.0–2.0s", beat: "HOOK", purpose: "Establish the protagonist, world and immediate visual question." },
      { time: "2.0–5.0s", beat: "ESCALATION", purpose: "A physical obstacle interrupts the protagonist's goal." },
      { time: "5.0–8.0s", beat: "TURN", purpose: "A surprising action or discovery changes the situation." },
      { time: "8.0–10.0s", beat: "PAYOFF", purpose: "Resolve the visual question with a memorable final image." }
    ],
    voiceover: {
      direction: "One expressive narrator; conversational, emotionally specific, never explain what the image already shows.",
      draft: "Every little journey begins with a reason to move. Then the world gets in the way. The clever part is what happens next."
    },
    shotList: [
      { time: "0.0–2.0s", shot: "Wide establishing shot", action: "Reveal the character and environment; begin a slow, motivated camera push." },
      { time: "2.0–5.0s", shot: "Medium tracking shot", action: "Follow the character's attempt; show readable body mechanics and the obstacle." },
      { time: "5.0–8.0s", shot: "Close-up into dynamic medium", action: "Capture the turning point with a clear reaction, anticipation and follow-through." },
      { time: "8.0–10.0s", shot: "Hero composition", action: "Land the emotional payoff; settle the camera with subtle environmental motion." }
    ],
    characterBible: {
      identity: "One lead character with a fixed silhouette, facial proportions, palette, costume and distinguishing prop.",
      continuityRules: [
        "Preserve face shape, eye spacing, body proportions, costume and prop across every shot.",
        "Use a model sheet with front, three-quarter and profile views before multi-shot production.",
        "Keep screen direction and eyelines consistent; no unexplained wardrobe or scale changes."
      ],
      performance: "Readable anticipation, weight shift, contact, follow-through, secondary motion and a held reaction."
    },
    environmentBible: {
      direction: "A specific, story-relevant location with foreground, midground and background depth.",
      continuityRules: [
        "Keep geography, object placement, weather and time of day consistent.",
        "Use motivated practical light sources and atmospheric depth.",
        "Let the environment react subtly to character movement where physically plausible."
      ]
    },
    visualDirection: {
      style: clean(style, "cinematic 2D animation, expressive characters, rich environments", 300),
      composition: "Layered staging, clear silhouette separation, purposeful negative space and readable focal hierarchy.",
      lighting: "Physically motivated key, fill and rim light; bounce light and contact shadows that respond to the setting.",
      animation: "Nuanced pose-to-pose movement with eased acceleration, anticipation, overlap and secondary motion.",
      camera: "Continuous subtle dolly or tracking movement; no arbitrary cuts or static slideshow framing."
    },
    soundPlan: {
      narration: "Record or synthesize after script approval; align breaths and emphasis with the action.",
      music: "A short original score that starts sparse, rises with escalation and resolves at the payoff.",
      effects: "Layer location ambience, character movement, contact sounds and a distinct payoff accent.",
      mix: "Dialogue intelligibility first; duck music under speech; synchronize transient effects to visible contact."
    },
    productionStages: [
      "Lock story, script and visual direction after review.",
      "Create character and environment reference sheets.",
      "Generate and inspect the key visual anchor before dependent shots.",
      "Generate video shots with continuity references and quality checks.",
      "Create narration, music and synchronized sound effects.",
      "Assemble, mix, render and validate the final MP4."
    ],
    generationEnabled: false
  };
}

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "animated-story-engine", version: "0.2.0" });
});

app.get("/api/status", (_req, res) => {
  const falKey = Boolean(process.env.FAL_KEY);
  const accessTokenConfigured = Boolean(process.env.ENGINE_ACCESS_TOKEN);
  const enabled = process.env.ENABLE_GENERATION === "true";
  const maxSpend = Number(process.env.MAX_GENERATION_USD || 0);
  const estimatedCostUsd = Number((10 * COST_PER_SECOND).toFixed(4));
  res.json({
    service: "animated-story-engine",
    plannerReady: true,
    provider: "fal",
    configured: { falKey, videoModel: Boolean(VIDEO_MODEL) },
    generationEnabled: Boolean(falKey && enabled && maxSpend >= estimatedCostUsd && accessTokenConfigured),
    accessTokenConfigured,
    generationChecks: {
      apiCredential: falKey,
      explicitEnableFlag: enabled,
      spendingCapCoversTest: maxSpend >= estimatedCostUsd,
      estimatedTestCostUsd: estimatedCostUsd,
      configuredSpendingCapUsd: maxSpend
    },
    videoModel: VIDEO_MODEL,
    note: "Generation is fail-closed. It requires a server-side Fal key, ENABLE_GENERATION=true, a sufficient MAX_GENERATION_USD cap, and an approved plan."
  });
});

app.post("/api/plan", (req, res) => {
  const concept = clean(req.body?.concept, "", 1000);
  if (concept.length < 8) return res.status(400).json({ error: "Add a story concept of at least 8 characters." });
  const duration = Number(req.body?.duration || 10);
  if (duration !== 10) return res.status(400).json({ error: "The first validation workflow is fixed to a 10-second test." });
  const plan = makePlan(concept, clean(req.body?.style, undefined, 300));
  res.json(plan);
});

function falEndpointBase(endpoint) {
  const parts = endpoint.split("/");
  if (parts.length < 3 || parts.some(part => !/^[a-zA-Z0-9._-]+$/.test(part))) {
    throw new Error("Invalid configured model endpoint.");
  }
  return "https://queue.fal.run/" + parts.join("/");
}
function falHeaders() {
  return { Authorization: "Key " + process.env.FAL_KEY, "Content-Type": "application/json" };
}
function buildVideoPrompt(plan) {
  return [
    "Create a polished 10-second cinematic 2D animated story, 16:9.",
    "STORY: " + plan.concept,
    "DRAMATIC ARC: hook, escalating physical obstacle, surprising turning point, emotionally clear payoff.",
    "SHOT PLAN: " + plan.shotList.map(s => s.time + " " + s.action).join(" "),
    "CHARACTER CONTINUITY: " + plan.characterBible.identity + " " + plan.characterBible.continuityRules.join(" "),
    "ENVIRONMENT: " + plan.environmentBible.direction + " " + plan.environmentBible.continuityRules.join(" "),
    "VISUAL STYLE: " + plan.visualDirection.style,
    "CAMERA: " + plan.visualDirection.camera,
    "LIGHTING: " + plan.visualDirection.lighting,
    "ANIMATION: " + plan.visualDirection.animation,
    "VOICEOVER INTENT: " + plan.voiceover.direction,
    "SOUND INTENT: " + plan.soundPlan.music + " " + plan.soundPlan.effects,
    "QUALITY: expressive character acting, rich layered backgrounds, coherent perspective, hand-crafted 2D animation, nuanced timing, cinematic composition, motivated light, no text, no logos, no flicker, no identity drift."
  ].join("\n");
}

function requireEngineAccess(req, res, next) {
  const expected = process.env.ENGINE_ACCESS_TOKEN || "";
  const supplied = (req.get("Authorization") || "").replace(/^Bearer\\s+/i, "");
  if (!expected) return res.status(503).json({ error: "Engine access is not configured." });
  const a = Buffer.from(expected);
  const b = Buffer.from(supplied);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return res.status(401).json({ error: "Enter the workspace access key to continue." });
  }
  next();
}

app.post("/api/generate", requireEngineAccess, async (req, res) => {
  const plan = req.body?.plan;
  const approved = req.body?.approved === true;
  const statusEnabled = process.env.ENABLE_GENERATION === "true";
  const maxSpend = Number(process.env.MAX_GENERATION_USD || 0);
  const estimatedCostUsd = Number((10 * COST_PER_SECOND).toFixed(4));

  if (!plan || plan.status !== "draft" || plan.durationSeconds !== 10 || !plan.planId) {
    return res.status(400).json({ error: "A valid 10-second pre-production draft is required." });
  }
  if (!approved) return res.status(403).json({ error: "Review and approve the complete pre-production plan first." });
  if (!process.env.FAL_KEY) return res.status(503).json({ error: "Fal API credential is not configured on the server." });
  if (!statusEnabled) return res.status(423).json({ error: "Generation is intentionally locked. ENABLE_GENERATION is not true." });
  if (maxSpend < estimatedCostUsd) {
    return res.status(402).json({ error: "The configured spending cap is below the estimated test cost.", estimatedCostUsd });
  }

  try {
    const base = falEndpointBase(VIDEO_MODEL);
    const response = await fetch(base, {
      method: "POST",
      headers: { ...falHeaders(), "X-Fal-Queue-Priority": "low", "X-Fal-No-Retry": "1", "X-Fal-Store-IO": "1" },
      body: JSON.stringify({
        prompt: buildVideoPrompt(plan),
        duration: 10,
        resolution: "768P",
        aspect_ratio: "16:9",
        prompt_expansion_mode: "quality",
        enable_safety_checker: true
      })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      return res.status(response.status).json({ error: payload.detail || payload.error || "Fal rejected the generation request.", provider: "fal" });
    }
    res.status(202).json({
      status: payload.status || "IN_QUEUE",
      requestId: payload.request_id,
      statusUrl: payload.status_url,
      responseUrl: payload.response_url,
      estimatedCostUsd,
      model: VIDEO_MODEL,
      planId: plan.planId
    });
  } catch (error) {
    res.status(502).json({ error: "Could not submit the generation request.", detail: error.message });
  }
});

app.get("/api/jobs/:requestId", requireEngineAccess, async (req, res) => {
  if (!process.env.FAL_KEY) return res.status(503).json({ error: "Fal API credential is not configured on the server." });
  const requestId = req.params.requestId;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)) {
    return res.status(400).json({ error: "Invalid request ID." });
  }
  try {
    const base = falEndpointBase(VIDEO_MODEL);
    const appBase = base.split("/").slice(0, 5).join("/");
    const statusResponse = await fetch(appBase + "/requests/" + requestId + "/status", { headers: falHeaders() });
    const status = await statusResponse.json().catch(() => ({}));
    if (!statusResponse.ok) return res.status(statusResponse.status).json({ error: status.detail || "Could not read job status." });
    if (status.status !== "COMPLETED") return res.json({ status: status.status, queuePosition: status.queue_position ?? null });
    const resultResponse = await fetch(appBase + "/requests/" + requestId, { headers: falHeaders() });
    const result = await resultResponse.json().catch(() => ({}));
    if (!resultResponse.ok) return res.status(resultResponse.status).json({ error: result.detail || "Could not retrieve completed job output." });
    res.json({ status: "COMPLETED", result });
  } catch (error) {
    res.status(502).json({ error: "Could not check the generation job.", detail: error.message });
  }
});

app.listen(port, "0.0.0.0", () => {
  console.log("Animated Story Engine listening on " + port);
});
