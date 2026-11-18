# Animated Story Engine

A cloud-hosted pre-production and video-generation workspace for short animated stories.

## Current architecture

- Railway / Express serves the dashboard and API.
- Pre-production planner builds a reviewable 10-second story plan: dramatic beats, narration draft, shot list, character and environment continuity bibles, visual direction, lighting, camera, animation and sound plan.
- Fal queue API submits the approved video prompt asynchronously, checks the original job, and retrieves the result. The Fal key remains server-side.
- Safety gates require an approved plan, ENABLE_GENERATION=true, a configured FAL_KEY, and a spending cap that covers the estimated request cost.
- No automatic retry is sent to Fal for paid generation requests.

## Railway configuration

Set these variables on the story-engine-api service only when ready:

| Variable | Purpose | Safe default |
| --- | --- | --- |
| FAL_VIDEO_MODEL | Exact Fal endpoint ID | minimax/h3-max/text-to-video |
| FAL_VIDEO_COST_PER_SECOND | Current planning estimate in USD | 0.0375 |
| FAL_KEY | Server-side Fal API key with request submit/read permissions | Not configured |
| ENABLE_GENERATION | Explicit generation master switch | false |
| MAX_GENERATION_USD | Maximum approved estimated cost per test | 0 |

For the selected H3 Max endpoint, the current catalog estimate is USD 0.0375 per second. A 10-second test is therefore estimated at USD 0.375. This is an estimate, not a guarantee of final billing. Re-check pricing before production changes.

Do not set the generation switch or spending cap until the account owner explicitly intends to run a paid generation. The server defaults to fail-closed behavior.

## API

- GET /health — process health.
- GET /api/status — credential presence, generation gates and cost estimate. Never returns secrets.
- POST /api/plan — creates a structured pre-production draft. Body fields: concept, duration=10, style.
- POST /api/generate — submits an approved 10-second plan to Fal. Body fields: plan, approved=true.
- GET /api/jobs/:requestId — reads status and completed result for a previously submitted job.

## Workflow

1. Write a story concept.
2. Generate the complete pre-production plan.
3. Review and approve the story, voiceover, visual direction, continuity and sound plan.
4. Only when the Fal account is funded and the server safety gates are deliberately enabled, submit the 10-second test.
5. Poll the same job ID; never resubmit a job just because it is still processing.
6. Inspect the output, then plan any separate narration, music, effects and final edit/render stages.

## Important current limitation

The dashboard and server-side queue integration are deployed code, not proof that video generation is currently available. The connected Fal account must have credits and a server-side API key. This app does not have access to ChatGPT's private Fal connection automatically. Audio production, multi-shot reference conditioning, persistent job history, and final MP4 assembly remain later production stages; do not describe them as complete until implemented and tested.

## Local development

Run npm install, then npm start.
