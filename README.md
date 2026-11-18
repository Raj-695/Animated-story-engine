# Animated Story Engine

Cloud-hosted pre-production and short-form animated-story production workspace.

## Implemented

- Railway-hosted Express dashboard and API.
- Six curated story starters plus a random-pick option.
- Structured 10-second pre-production plan: dramatic arc, voiceover draft, shot list, character and environment continuity, visual style, lighting, animation, camera and sound plan.
- Fal queue integration for one 10-second video, narration, original instrumental music, ambience, character foley and a payoff sound effect.
- Job polling uses each original request ID and does not resubmit pending jobs.
- Paid production is fail-closed: it requires a server-side Fal key, an explicit generation switch, a sufficient estimated-cost cap, workspace authentication and approval of the plan.
- No automatic retry is sent for paid Fal jobs.

## Not yet complete or verified

- The connected Fal account currently has no credits, so generation and uploads are blocked.
- A Fal API key has not been placed in Railway. ChatGPT's private Fal connection is not automatically available to the Railway container.
- Final audio synchronization, mixing, MP4 assembly and decoder-based quality checks are not yet implemented.
- The workspace has not completed an actual paid or free generated-video test. Do not treat a successful Railway deployment as proof of a completed video.

## Railway service variables

| Variable | Purpose | Default / current state |
| --- | --- | --- |
| FAL_VIDEO_MODEL | Exact Fal video endpoint | minimax/h3-max/text-to-video |
| FAL_VIDEO_COST_PER_SECOND | Video estimate in USD | 0.0375 |
| FAL_KEY | Server-side Fal key with request submit/read permissions | Not configured |
| ENGINE_ACCESS_TOKEN | Private workspace access key | Configured as a Railway secret |
| ENABLE_GENERATION | Explicit generation master switch | false unless deliberately enabled |
| MAX_GENERATION_USD | Maximum estimated total cost per production run | 0 unless deliberately raised |

Current estimated production costs for a 10-second test:
- Video: approximately USD 0.375
- Narration: approximately USD 0.01, based on the current draft length
- 10-second instrumental music: approximately USD 0.10
- Three short sound-effect layers: approximately USD 0.012
- Total estimate: approximately USD 0.50

These are rate-based estimates, not guaranteed final charges. Check live pricing before production changes. Do not enable generation or raise the cap unless the account owner intends to spend.

## API

- GET /health — health check.
- GET /api/status — credential presence, model and cost/safety gates. Never returns secrets.
- GET /api/ideas — six curated story concepts.
- POST /api/plan — creates a structured pre-production draft. Body fields: concept, duration=10, style.
- POST /api/produce — submits the approved video and audio jobs. Requires Bearer workspace access token and approved=true.
- GET /api/jobs/:jobType/:requestId — checks an existing job and retrieves its completed result. Job types: video, narration, music, ambience, foley, payoff.

## Production workflow

1. Pick a story idea or enter a concept.
2. Generate and review the complete pre-production plan.
3. Approve the story, narration, visual direction, continuity and sound plan.
4. When the Fal account is funded and server-side gates are deliberately enabled, submit the production jobs.
5. Track each accepted job by its original request ID.
6. Inspect the video and separate audio assets.
7. Complete the remaining assembly stage: synchronize narration, music and effects, mix, render MP4, then validate duration, audio and codec.

## Local development

Run npm install, then npm start.
