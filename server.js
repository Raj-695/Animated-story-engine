import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID, timingSafeEqual } from "node:crypto";

const app = express();
const port = Number(process.env.PORT || 8080);
const root = path.dirname(fileURLToPath(import.meta.url));
const VIDEO_MODEL = process.env.FAL_VIDEO_MODEL || "minimax/h3-max/text-to-video";
const COST_PER_SECOND = Number(process.env.FAL_VIDEO_COST_PER_SECOND || 0.0375);
const AUDIO_ENDPOINTS = {
  narration: "elevenlabs/tts/eleven-v4",
  music: "elevenlabs/music/v2.5",
  ambience: "elevenlabs/sound-effects/v3",
  foley: "elevenlabs/sound-effects/v3",
  payoff: "elevenlabs/sound-effects/v3"
};
const VIDEO_ENDPOINT = VIDEO_MODEL;
const STORY_IDEAS = [
  { title: "The Lighthouse in a Teacup", genre: "Whimsical · heartfelt", concept: "A tiny lighthouse keeper living inside a teacup spots a storm approaching a fleet of paper boats and must guide them safely through a kitchen sink." },
  { title: "The Ghost Who Hated Scaring People", genre: "Comedy · warm", concept: "A gentle ghost tries to frighten a family out of an old house, but every attempt accidentally helps them fix something, until they invite the ghost to stay." },
  { title: "Express Delivery to the Moon", genre: "Adventure · wonder", concept: "A determined delivery pigeon discovers that the last package in its bag is addressed to the moon, then builds a ridiculous chain of lifts to complete the delivery." },
  { title: "The Umbrella with Stage Fright", genre: "Comedy · character-driven", concept: "An umbrella dreams of becoming a parachute, but freezes every time the wind picks it up, until a tiny leaf needs rescuing from a rooftop." },
  { title: "One More Battery", genre: "Emotional · sci-fi", concept: "A little maintenance robot with one battery bar left spends its final energy helping a lost child find the way home, then discovers a small light left glowing for it." },
  { title: "The Dragon's Tiny Hiccup", genre: "Comedy · fantasy", concept: "A young dragon's hiccups accidentally set off tiny fireworks across a village, and the dragon must learn to control the sparks before the big festival finale." }
];

function estimateCost(plan) {
  const chars = String(plan?.voiceover?.draft || "").length || 150;
  const video = 10 * COST_PER_SECOND;
  const narration = chars / 1000 * 0.08;
  const music = 10 / 60 * 0.6;
  const effects = 6 * 0.002;
  return {
    video: Number(video.toFixed(4)),
    narration: Number(narration.toFixed(4)),
    music: Number(music.toFixed(4)),
    soundEffects: Number(effects.toFixed(4)),
    total: Number((video + narration + music + effects).toFixed(2))
  };
}

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

app.get("/api/ideas", (_req, res) => res.json({ ideas: STORY_IDEAS, choice: "Let the engine choose" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "animated-story-engine", version: "0.2.0" });
});

app.get("/api/status", (_req, res) => {
  const falKey = Boolean(process.env.FAL_KEY);
  const accessTokenConfigured = Boolean(process.env.ENGINE_ACCESS_TOKEN);
  const enabled = process.env.ENABLE_GENERATION === "true";
  const maxSpend = Number(process.env.MAX_GENERATION_USD || 0);
  const estimatedCosts = estimateCost({ voiceover: { draft: "Every little journey begins with a reason to move. Then the world gets in the way. The clever part is what happens next." } });
  const estimatedCostUsd = estimatedCosts.total;
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
      costBreakdown: estimatedCosts,
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

app.post("/api/produce", requireEngineAccess, async (req, res) => {
  const plan = req.body?.plan;
  const approved = req.body?.approved === true;
  const enabled = process.env.ENABLE_GENERATION === "true";
  const costs = estimateCost(plan);
  const maxSpend = Number(process.env.MAX_GENERATION_USD || 0);

  if (!plan || plan.status !== "draft" || plan.durationSeconds !== 10 || !plan.planId) {
    return res.status(400).json({ error: "A valid 10-second pre-production draft is required." });
  }
  if (!approved) return res.status(403).json({ error: "Review and approve the complete pre-production plan first." });
  if (!process.env.FAL_KEY) return res.status(503).json({ error: "Fal API credential is not configured on the server." });
  if (!enabled) return res.status(423).json({ error: "Generation is intentionally locked. ENABLE_GENERATION is not true." });
  if (maxSpend < costs.total) {
    return res.status(402).json({ error: "The configured spending cap is below the estimated full test cost.", estimatedCostUsd: costs.total, costBreakdown: costs });
  }

  const requests = [
    {
      type: "video",
      endpoint: VIDEO_ENDPOINT,
      input: {
        prompt: buildVideoPrompt(plan),
        duration: 10,
        resolution: "768P",
        aspect_ratio: "16:9",
        prompt_expansion_mode: "quality",
        enable_safety_checker: true
      }
    },
    {
      type: "narration",
      endpoint: AUDIO_ENDPOINTS.narration,
      input: {
        text: plan.voiceover.draft,
        voice: "Rachel",
        stability: 0.35,
        similarity_boost: 0.75,
        output_format: "mp3_44100_128",
        enable_safety_checker: true
      }
    },
    {
      type: "music",
      endpoint: AUDIO_ENDPOINTS.music,
      input: {
        prompt: "Original 10-second cinematic instrumental score for a short animated story. Begin with a delicate, curious motif, build a little tension in the middle, then resolve warmly and memorably. Orchestral textures blended with subtle modern sound design, clear emotional arc, no vocals, no lyrics.",
        music_length_ms: 10000,
        force_instrumental: true,
        output_format: "mp3_48000_192",
        enable_safety_checker: true
      }
    },
    {
      type: "ambience",
      endpoint: AUDIO_ENDPOINTS.ambience,
      input: {
        text: "Soft, believable environmental ambience matching the story location, gently evolving over two seconds, clean recording, no music, no voices.",
        duration_seconds: 2,
        prompt_influence: 0.7,
        enable_safety_checker: true
      }
    },
    {
      type: "foley",
      endpoint: AUDIO_ENDPOINTS.foley,
      input: {
        text: "Close, tactile character movement and physical contact sounds synchronized to a small animated character moving through its environment, two seconds, no music, no speech.",
        duration_seconds: 2,
        prompt_influence: 0.8,
        enable_safety_checker: true
      }
    },
    {
      type: "payoff",
      endpoint: AUDIO_ENDPOINTS.payoff,
      input: {
        text: "A distinctive, emotionally satisfying magical reveal accent with a soft rising shimmer and warm resonant tail, two seconds, no music, no speech.",
        duration_seconds: 2,
        prompt_influence: 0.8,
        enable_safety_checker: true
      }
    }
  ];

  const results = await Promise.allSettled(requests.map(async item => {
    const response = await fetch(falEndpointBase(item.endpoint), {
      method: "POST",
      headers: { ...falHeaders(), "X-Fal-Queue-Priority": "low", "X-Fal-No-Retry": "1", "X-Fal-Store-IO": "1" },
      body: JSON.stringify(item.input)
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.detail || payload.error || ("Fal rejected " + item.type));
    return {
      type: item.type,
      endpointId: item.endpoint,
      requestId: payload.request_id,
      statusUrl: payload.status_url,
      responseUrl: payload.response_url,
      status: payload.status || "IN_QUEUE"
    };
  }));

  const jobs = results.map((result, index) => result.status === "fulfilled"
    ? { ...result.value, accepted: true }
    : { type: requests[index].type, endpointId: requests[index].endpoint, accepted: false, error: result.reason?.message || "Submission failed." });
  const acceptedCount = jobs.filter(job => job.accepted).length;
  res.status(acceptedCount ? 202 : 502).json({
    status: acceptedCount === jobs.length ? "accepted" : acceptedCount ? "partial" : "failed",
    planId: plan.planId,
    estimatedCostUsd: costs.total,
    costBreakdown: costs,
    jobs
  });
});

app.get("/api/jobs/:jobType/:requestId", requireEngineAccess, async (req, res) => {
  if (!process.env.FAL_KEY) return res.status(503).json({ error: "Fal API credential is not configured on the server." });
  const requestId = req.params.requestId;
  const jobType = req.params.jobType;
  const endpoint = jobType === "video" ? VIDEO_ENDPOINT : AUDIO_ENDPOINTS[jobType];
  if (!endpoint) return res.status(400).json({ error: "Unknown job type." });
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)) {
    return res.status(400).json({ error: "Invalid request ID." });
  }
  try {
    const base = falEndpointBase(endpoint);
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

