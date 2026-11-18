# Animated Story Engine

A cloud-hosted pre-production workspace for 10-second animated-story tests.

## Current capabilities
- Health endpoint at `/health`
- Provider configuration status at `/api/status`
- 10-second pre-production draft endpoint at `/api/plan`
- Browser workspace for drafting a story concept

## Deploy
Railway detects the Node.js project and runs `npm start`. The service listens on Railway's `PORT` (default 8080).

## Generation safety
Video generation is intentionally not wired to a billable model yet. Before production is enabled:
1. Select a video model using its current published schema and price.
2. Add the fal API key as the Railway secret `FAL_KEY`.
3. Set `FAL_VIDEO_MODEL` to the verified endpoint.
4. Add model-specific input validation and job polling.
5. Keep story/visual/audio review approval-gated.

Do not commit API keys or other secrets.
