---
title: 'Self-Hosted Video API: Upload, Processing, Playback, Webhooks, and Asset Lifecycle'
seoTitle: 'Self-Hosted Video API: Upload, Processing, Playback, Webhooks & Lifecycle'
description: 'Learn how a self-hosted video API handles upload, async processing, playback, webhooks, and asset lifecycle with Ollanode as a practical reference.'
category: 'Video Infrastructure & Developer Platforms'
pubDate: 2026-09-03
author: 'The OllaNode Team'
tags: ['Video & CDN', 'Video API', 'Self-Hosted', 'VOD', 'HLS', 'Webhooks', 'Asset Lifecycle', 'OpenAPI', 'Apache-2.0']
---

Most video integrations fail in the same place: the team treats “upload a file” as the product. Upload is only the first contract. A production self-hosted video API has to own five coupled surfaces—ingest, async processing, playback, webhooks, and an explicit asset lifecycle—or your app ends up polling half-finished objects, serving private bytes from the wrong origin, and guessing when a video is actually ready to publish.

Managed platforms hide that contract behind one SDK call. That works until you need residency, private delivery, predictable cost, or product-specific policy. Then you discover the real work was never encoding. It was API design: create-before-bytes, status machines, signed manifests, HMAC event delivery, soft deletes, and idempotent retries.

This guide is the API-shaped version of that problem. It is not a product launch post, not a Mux billing rant, not a first-pipeline quickstart, and not an HLS ladder tuning walkthrough. It is a contract-level deep dive into how a self-hosted video API should behave end to end—using Ollanode as a concrete, Apache-2.0, VOD-only reference with OpenAPI 3.1, four ingest paths, async workers, signed HLS playback, and Mux-compatible webhook names.

---

## Self-Hosted Video API: Complete Guide to Upload, Processing, Playback & Webhooks

| Question | Quick answer |
| :--- | :--- |
| **What is it?** | A project-scoped REST/OpenAPI control plane that creates video records, accepts uploads, runs async processing, returns playback URLs, emits lifecycle webhooks, and manages asset state until delete. |
| **What must it cover?** | Upload/ingest, processing status, playback tokens, webhook delivery, and a clear lifecycle (created → … → ready \| errored). |
| **How is it different from ffmpeg + S3?** | Scripts move bytes. An API owns auth scopes, idempotency, job status, signed delivery, retries, and audit. |
| **VOD or live?** | Serious self-hosted APIs often start VOD-only. Live/RTMP is a different protocol and ops problem. Ollanode is VOD-only today. |
| **Biggest design rule?** | Never encode inside the HTTP request. Create fast, process async, notify with signed webhooks. |
| **Biggest mistake?** | Treating “file landed in a bucket” as “video is ready,” then shipping broken players and racey publish flows. |

A self-hosted video API is the product surface your backend, frontend, CI, and agents call. The workers, storage, and CDN matter—but the API is what makes those layers automatable without tribal knowledge.

<div class="key-takeaways-box" id="key-takeaways">
  <div class="key-takeaways-header">
    <span class="key-takeaways-icon">✦</span>
    <h3 class="key-takeaways-title">KEY TAKEAWAYS</h3>
  </div>
  <ul class="key-takeaways-list">
    <li><strong>Create the record before the bytes:</strong> A <code>vid_…</code> identity, policy, and status exist before upload starts.</li>
    <li><strong>Offer more than one ingest path:</strong> Presigned PUT, multipart, resumable TUS, and pull-from-URL solve different failure modes.</li>
    <li><strong>Processing must be async:</strong> Validate → metadata → transcode → HLS → thumbnails/transcripts → store → webhook → mark ready.</li>
    <li><strong>Playback is a separate data plane:</strong> Private storage never serves viewers directly; signed tokens and cookies gate HLS.</li>
    <li><strong>Webhooks are the production integration:</strong> Polling is for debugging; HMAC-signed events drive publish pipelines.</li>
    <li><strong>Lifecycle is a state machine, not a boolean:</strong> <code>ready</code> and <code>errored</code> are terminal outcomes with different product consequences.</li>
    <li><strong>API quality shows up under retries:</strong> Idempotency keys, request IDs, soft deletes, and dead-lettered deliveries decide whether automation is safe.</li>
    <li><strong>Ollanode is a useful reference contract:</strong> OpenAPI 3.1, four ingest paths, progress status, signed/public playback, Mux-compatible events, and ownership-first VOD scope.</li>
  </ul>
</div>

---

## 1. Problem Statement: Why Video APIs Fail in Production

In 2026, video is product surface area. It is onboarding, course content, sales demos, support libraries, compliance evidence, and customer-facing product features. The moment video becomes core, teams stop asking whether they can encode a file and start asking whether their backend can trust the API.

That trust breaks in predictable ways.

**Race conditions** are the first failure. The UI shows “uploaded” while the player still receives a conflict response because processing has not finished. Product code treats object-storage success as readiness. Support then fields tickets that look like player bugs but are really lifecycle bugs.

**Wrong security boundaries** are the second failure. Teams expose bucket URLs, forget token expiry, or allow progressive MP4 download for content that was meant to stay gated. Private training libraries leak through a “temporary” public object. Signed playback was supposed to be the default; someone shipped a shortcut.

**Webhook blindness** is the third failure. Without signed events and delivery history, publish pipelines poll forever, miss failures, or double-publish on retries. A lesson page goes live twice. A catalog row stays draft forever because one non-2xx response was ignored.

**Lifecycle gaps** are the fourth failure. Soft delete, purge, errored recovery, and the fate of child clips are undefined. Operations invent tribal scripts. Finance cannot explain storage growth. Compliance cannot prove retention policy.

**Opaque SaaS contracts** are the fifth failure. Managed APIs work until residency, private-origin policy, or cost predictability force ownership. Then the missing piece is not ffmpeg. It is a control plane you can run, inspect, and automate.

A self-hosted video API exists to make those contracts explicit. If your platform cannot answer “when is this asset publishable?” with a status field and a signed webhook, you do not have a video API. You have storage with extra steps.

---

## 2. A Short History of Video API Contracts

Early teams glued ffmpeg, a bucket, and a CDN together. It worked for demos. It failed for products because every product need became a custom script: resumable upload, status polling, thumbnail generation, signed URLs, purge, retries, and audit. The glue held until the first on-call weekend.

Managed video APIs professionalized the contract. Create an asset, upload, wait for ready, play with a token, subscribe to webhooks. That model won because it matched how backends already integrate payments, email, and object storage. Developers did not want a transcoder. They wanted a reliable state machine with a playback URL at the end.

Self-hosted platforms are now catching up to that same contract shape without forcing every encode minute through someone else’s meter. The important shift in 2026 is not that open source can encode. It is that open source can expose a durable API: scopes, idempotency, lifecycle, playback gating, and event delivery.

Ollanode sits in that lineage. One project-scoped REST API for video, with workers and delivery behind it, VOD-only, HLS today, Apache-2.0 licensing for commercial products. The point of this article is the contract, not a tour of every adjacent platform feature.

---

## 3. Definition: Self-Hosted Video API

A self-hosted video API is software you operate that exposes authenticated, project-scoped endpoints to create video assets, ingest media, process them asynchronously into adaptive streams, return gated playback URLs, emit signed lifecycle events, and manage the asset until soft-delete and storage purge.

It is not a bare transcoder CLI. It is not a public S3 bucket with playlist files dropped beside the source. It is not a live or RTMP encoder farm. It is not a dashboard with no machine-readable contract.

It is a control plane with a documented state machine and a separate playback data plane. Your application should be able to automate the full path with HTTP, signatures, and status—not with SSH and tribal knowledge.

---

## 4. Architecture: Control Plane vs Data Plane

A credible self-hosted video API splits into two planes, even when both run in your own infrastructure.

**The control plane** answers intent. Create this asset. Use signed playback. Cap height at 1080p. Encrypt the HLS package. Notify these webhook endpoints when the asset is ready or errored. List inventory. Soft-delete and purge.

**The data plane** answers bytes. PUT upload parts to object storage. Fetch manifests. Stream segments. Cache at the edge. Deliver AES keys through the same gated path as media when encryption is enabled.

For a broader look at self-hosted video infrastructure, see our guide to Best Open Source Video Infrastructure.

Your application, CI system, or agent talks to the API gateway with bearer tokens or API keys. That gateway enforces authentication, scopes, rate limits, idempotency, and request IDs. Behind it, the control plane creates records, mints upload targets, tracks status, mints playback tokens, and manages webhook subscriptions. Storage holds originals and derivatives. Async workers validate, encode, package, and enrich. The playback host and CDN edge deliver to viewers without exposing private buckets.

Ollanode makes that split concrete. The API host is for API keys and project-scoped administration. The playback host is for token- and cookie-gated HLS and is intentionally outside the OpenAPI surface that viewers should never treat as an admin API. That separation is not cosmetic. It is how you keep privileged control operations away from high-volume media traffic.

---

## 5. Internal Working: Request Path and Job Path

Every healthy video API has two clocks.

### Request path
The request path should complete in milliseconds to low hundreds of milliseconds. Authenticate the bearer token or API key. Authorize the required scope, such as `videos:write` or `videos:read`. Create or mutate a record. Return identifiers, upload targets, or playback URLs. Attach a request ID and rate-limit headers.

No request handler should wait for a 4K ladder. If your create-video endpoint blocks on transcoding, you do not have an API. You have a synchronous batch job wearing an HTTP costume.

### Job path
The job path runs in seconds to minutes depending on duration, preset, and hardware. Upload completion fires an internal event. Workers validate media integrity. Metadata extraction reads duration, codecs, resolution, frame rate, and audio presence. Those facts drive ladder decisions, especially the no-upscaling rule. Transcode and HLS packaging run in worker pools. Thumbnails and transcripts are generated. Assets are stored. Webhooks fan out. Status becomes `ready` or `errored`.

In Ollanode, long-running work runs in worker pools over NATS JetStream, with optional Temporal for durable workflows. The HTTP handler never encodes. Your app either polls `GET /v1/videos/{id}/status` or waits for HMAC-signed events such as `video.asset.ready` and `video.asset.errored`.

That dual-path design is the difference between a demo that works on one file and a product that survives retries, mobile networks, and publish automation.

---

## 6. Components of the API Surface

| Component | Responsibility | Failure if missing |
| :--- | :--- | :--- |
| **Auth and scopes** | Project isolation, least privilege | Cross-tenant leaks, overpowered keys |
| **Video CRUD** | Identity, metadata, policy | Orphaned files, no inventory |
| **Ingest adapters** | Presigned, multipart, TUS, pull URL | Broken large or flaky uploads |
| **Status API** | Cheap lifecycle and progress | Expensive polling, UI guesswork |
| **Processing outputs** | Assets, thumbs, transcripts, clips | Incomplete player experience |
| **Playback API** | Signed or public master URL | Private content exposure or readiness races |
| **Webhook system** | Signed events, retries, dead letters | Fragile publish automation |
| **Delete and purge** | Soft delete plus async storage cleanup | Cost and compliance debt |

These are the components buyers should evaluate before they ask about codec presets. Codec choice matters, but an excellent encoder behind a weak lifecycle still produces unpublishable product states.

---

## 7. End-to-End Workflow

A production loop looks like this in practice:

1. **First, `POST /v1/videos` creates a `vid_…` record** with policy and quality settings. The record exists before any bytes exist. That identity is what every later call, webhook, and playback URL will reference.
2. **Second, the client uploads through the chosen ingest path.** For direct uploads, bytes bypass the API and land in object storage. The API only orchestrates.
3. **Third, a finalize or complete call starts the pipeline.** For multipart, complete itself starts processing. For TUS, a completion hook binds the upload to the video through a one-time token. For pull-from-URL, the platform fetch completion starts processing.
4. **Fourth, status moves through `uploaded`, then `processing`, then `ready` or `errored`.** Intermediate webhooks can fire for processing start, transcode completion, thumbnail readiness, and transcript readiness.
5. **Fifth, the terminal webhook arrives.** On success, the backend fetches playback details and publishes to the catalog. On failure, the backend surfaces `error_reason` and routes the asset into an ops or creator-facing recovery path.
6. **Sixth, the player requests the manifest and segments through the playback host.** Sidecar tracks such as subtitles, chapters, and storyboards use the same gate.

Later, operators patch metadata, rotate access rules, or soft-delete retired assets. Soft-delete should trigger asynchronous storage purge so HTTP clients are not left waiting on recursive deletes.

There is also a shortcut path. Pass `source_url` on create and skip client upload entirely. The platform fetches the remote file with SSRF vetting and size caps, then starts processing in the background. This is the migration-friendly path for back catalogs already sitting on an origin you control.

---

## 8. Upload and Ingest in Depth

Upload is where most DIY stacks look finished and are not.

### Create before bytes
Everything starts by creating the video record:

```bash
curl -X POST https://api.ollanode.com/v1/videos \
  -H "Authorization: Bearer $OLLANODE_API_KEY" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: create-allhands-2026q3" \
  -d '{
    "title": "Q3 All-Hands",
    "playback_policy": "signed",
    "quality_preset": "high",
    "max_height": 1080,
    "encrypt": true,
    "access_rules": { "allowed_countries": ["US","IN"] }
  }'
```

Important create-time fields include `playback_policy` (`signed` by default, or `public`), `quality_preset` (`low`, `standard`, `high`, or `av1`), `max_height` to cap ladder height without upscaling above source, `encrypt` for AES-128 HLS, `access_rules` for country or referrer gating, and `source_url` for pull ingest. The create response also returns a one-time `upload_token` for TUS.

Creating first is not ceremony. It gives you a stable ID for retries, a place to attach policy before bytes arrive, and a tenant-bound target for resumable uploads.

### Four ingest paths

| Path | Best for | How it works |
| :--- | :--- | :--- |
| **Presigned PUT** | Small and medium files | Mint URL, PUT whole file, call upload-complete |
| **Multipart** | Large files | Begin, presign parts, complete and start pipeline |
| **TUS resumable** | Browser and flaky networks | tusd at `/files/` with `videoId` and one-time `uploadToken` |
| **`source_url`** | Migrations and remote masters | Platform fetches; no separate upload step |
For a deeper implementation walkthrough, see our guide on How to Generate Dynamic HLS Resolution Ladders.
The design rule for direct uploads is simple. Bytes never pass through the API. The API orchestrates. Object storage receives the PUT.

- **Presigned PUT pattern:** Mint a short-lived upload URL, PUT the whole file to that URL, then finalize with upload-complete and the observed size. Finalization is what starts the pipeline. If you skip finalize, you have an object in storage and a video record that never becomes ready. This path is ideal when the client is trusted enough to complete a single PUT and the file is not huge. It is also easy to reason about in backend-to-backend transfers.
- **Multipart pattern:** Begin a multipart upload, presign each part, PUT the parts while capturing ETags, then complete with the part list. Complete finalizes the object and starts the pipeline. No separate upload-complete call is required. Multipart exists because large masters fail in the real world. Networks drop. Proxies time out. Mobile creators switch cells. A single PUT for an eight-gigabyte file is an incident waiting to happen.
- **TUS pattern:** Point a TUS client at your tusd endpoint with metadata for `videoId` and `uploadToken`. The upload server stores the object and calls a secret-gated completion hook that binds the upload to the video through that one-time token. A wrong or absent token is ignored. That failure mode is intentional. It is what keeps resumable uploads tenant-isolated. Choose TUS when the uploader is a browser on an unreliable network and page reloads are normal. Do not force every server-side migration through TUS just because it is trendy.

---

## 9. Processing and Status Contracts

Once bytes land, the API’s job is honesty about progress.

### Lifecycle states
The canonical path is `created`, then `upload_pending`, then `uploaded`, then `processing`, then `ready` or `errored`.

Cheap status polling should exist specifically so clients do not fetch the full video object every second:

```bash
curl https://api.ollanode.com/v1/videos/vid_7Qk3.../status \
  -H "Authorization: Bearer $OLLANODE_API_KEY"
```

A useful response includes the current state, an optional `error_reason`, and live progress from 0 to 100 while processing. Use status for UI. Use webhooks for backend automation.

### What processing should produce
A serious VOD API does more than one MP4. It should produce an adaptive HLS ladder that is source-aware and does not invent fake upscales, progressive MP4 and audio MP3 where policy allows, poster images, sampled frames, storyboard sprites with WebVTT cues, word-level transcripts in VTT and SRT, an asset inventory endpoint, optional sub-clips as child videos, and optional AI metadata suggestions after a transcript exists.

Ollanode’s pipeline stages map cleanly onto events: validate, extract metadata, transcode, generate HLS, thumbnails, transcript, store assets, emit webhook, mark ready. Non-encrypted packaging uses CMAF and fragmented MP4 segments. Encrypted packaging uses MPEG-TS with AES-128 key references rewritten through the gated playback path.

### Honesty about reprocess
There is no public “reprocess” button as a substitute for operations. Stuck or lost jobs should be recovered by background redispatch and reaper loops. Re-process from errored is a state-machine property, not a tribal SSH ritual, and not something agents should receive as an unbounded admin hammer without governance.

Your product code should assume that `errored` is terminal from the API consumer’s point of view unless your platform documents a supported recovery transition. Guessing is how duplicate encodes and split-brain catalogs appear.

---

## 10. Playback and Delivery Contracts

Playback is where security and user experience meet.

### Core rule
Bytes are never served directly from private storage. The playback host proxies and rewrites every HLS URI through itself, gated by a signed expiring token and the HttpOnly cookie it sets.

```bash
curl https://api.ollanode.com/v1/videos/vid_7Qk3.../playback \
  -H "Authorization: Bearer $OLLANODE_API_KEY"
```

A useful response includes `master_url`, `token` for signed policy, `policy`, `expires_at`, `poster_url`, and subtitle tracks. If the video is not ready, return conflict. Do not invent a half-working URL that fails three segment requests later.

### Manifest and cookie model
The player hits the playback host manifest endpoint with the token. The host fetches the master playlist from private storage, rewrites every variant URI back through itself carrying the token, and sets an HttpOnly cookie scoped to that video so segment requests carry authentication automatically. That cookie design is what lets a CDN edge cache segments while still authenticating requests. Geo and referrer rules can be enforced on this path for both signed and public playback.

Segments and AES-128 keys are served through the same gated segment route. There should be no separate unprotected key endpoint. Range requests should be honored for seeking. Missing or invalid tokens should fail closed.

### Sidecars and embed
The same gate should cover subtitles, chapters, and storyboard cues plus sprite sheets. An embeddable player can wire quality selection, hover scrub previews, chapters, captions, and parent-page seek control without forcing every team to rebuild a player from scratch. In Ollanode’s case, the hosted Vidstack embed supports those behaviors and accepts seek messages from a parent page.

### Progressive download restriction
A download endpoint for progressive MP4 or MP3 should only work for public, non-encrypted videos. Signed or encrypted assets returning forbidden on plaintext download is a feature. A downloadable master defeats gated HLS. Teams that need offline packages should design an explicit entitlement flow, not accidentally inherit one through storage URLs.

### Analytics
Playback is also where audience signals appear: per-video views and project rollups across countries, devices, and referrers. Those metrics belong beside the playback contract because they are captured on the delivery path, not invented by the control plane after the fact.

---

## 11. Webhooks and Event-Driven Integration

If upload, processing, and playback are the nouns, webhooks are the verbs your product actually runs on.

### Subscribe carefully

```bash
curl -X POST https://api.ollanode.com/v1/webhooks \
  -H "Authorization: Bearer $OLLANODE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "url":"https://hooks.example.com/olla",
    "events":["video.asset.ready","video.asset.errored"]
  }'
```

Store the signing secret immediately. It is shown once. List endpoints should not re-expose it. Patch should let you rotate URL, event set, or active state. Delivery history should be queryable newest first with status and response codes.

Webhook URLs should be SSRF-vetted. An open webhook create endpoint that can hit internal metadata services is an incident.
For a broader architecture view, see our guide to Multi-Tenant Self-Hosted Video Platform.

### Event vocabulary
Mux-compatible naming helps migrations and mental models.

| Event | Fires when |
| :--- | :--- |
| `video.asset.created` | A video record is created |
| `video.asset.processing` | The pipeline starts |
| `video.asset.transcoded` | The ladder is encoded |
| `video.asset.thumbnail.ready` | Thumbnails or storyboard are ready |
| `video.asset.track.ready` | A transcript or subtitle track is ready |
| `video.asset.ready` | The video is playable |
| `video.asset.errored` | Processing failed |
| `function.error_spike` | An edge function error rate spikes |

Subscribe to specific names for product clarity, or to all events when you are building an internal event bus. Most product backends only need `ready` and `errored` on the critical path, with thumbnail and track events as optional enrichments.

### Signature and retries
Every delivery should carry an HMAC signature header over the raw body, plus event name and delivery ID headers. Verify with a timing-safe compare. Never parse JSON before verifying the raw body. Never recompute over a re-serialized payload.

Ollanode retries failed deliveries at 10 seconds, 30 seconds, 2 minutes, 10 minutes, 30 minutes, and 2 hours, up to six attempts, then dead-letters. Delivery statuses include `pending`, `delivering`, `delivered`, `failed`, and `dead_lettered`. Fan-out is deduped per event and webhook pair so retries do not create chaotic duplicates at the platform layer. Your receiver still needs idempotency, because at-least-once delivery is the honest model.

### Product pattern
Treat `video.asset.ready` as the publish trigger. Verify the signature. Load the video ID. Fetch playback and poster. Write to your catalog as publishable. Acknowledge with a 2xx quickly. If your catalog write is heavy, enqueue work and acknowledge first so retries do not amplify load.

Treat `video.asset.errored` as an ops and product failure path with a real reason, not a silent dead upload. Creators deserve a message. On-call deserves a metric.

---

## 12. Asset Lifecycle End to End

Lifecycle is the difference between a demo and a platform.

### State machine responsibilities

| State | Product meaning | API consumer action |
| :--- | :--- | :--- |
| `created` | Identity exists | Start ingest |
| `upload_pending` | Upload target issued | Continue or resume upload |
| `uploaded` | Bytes landed | Wait for processing |
| `processing` | Workers active | Show progress; do not play |
| `ready` | Playable package exists | Publish and mint playback |
| `errored` | Terminal failure | Surface reason; apply retry strategy |

- **Mutations after create:** Standard tenant-scoped CRUD still matters after ingest. List and filter. Fetch full metadata, chapters, and access rules. Patch title, playback policy, metadata, library association, or access rules. Soft-delete the video and asynchronously purge storage. In governed setups, agent deletes may return acceptance with an approval requirement instead of immediate deletion. Ready videos in list responses can include short-lived poster URLs. That is convenient for admin UIs and dangerous if you accidentally treat those posters as permanent public CDN links.
- **Child assets and derivatives:** Clips, transcripts, thumbnails, and HLS renditions are part of the asset graph. Deleting a parent should not leave unpaid storage orphans. Inventory endpoints exist so finance and compliance can see what still occupies bytes. If your platform supports frame-accurate sub-clips as child videos, document whether children survive parent delete and whether they inherit playback policy.
- **Retention mindset:** Lifecycle is not only encode states. It is also how long originals are kept after derivatives exist, whether errored uploads are retained for forensics, when CDN purge accompanies delete, and how signed playback tokens expire relative to session length. Write those policies down before catalog scale. APIs without retention rules become expensive junk drawers with excellent OpenAPI docs.

---

## 13. Configuration Patterns That Matter

- **Per-create policy, not global hope:** Set playback policy, quality preset, max height, and encryption at create time for the common case. Keep project defaults sane. Override per asset only for outliers such as a single cinematic trailer in a catalog of screen recordings.
- **Idempotency on mutating calls:** Use idempotency keys for create and finalize flows. Same key and same body should replay safely. Same key and different body should fail closed. This is what makes mobile retries and queue redeliveries safe.
- **Webhook subscription hygiene:** Separate endpoints for product publish and ops paging. Rotate secrets. Monitor dead-letter counts. Keep receivers fast. SSRF-vet URLs at create time and again if URLs can be patched.
- **Playback token TTL:** Mint per viewer or session server-side. Do not embed immortal tokens in emails, CMS fields, or public documentation. Short-lived tokens plus refresh on the control plane beat long-lived tokens every time.
- **Access rules as product policy:** Country and referrer gating belong in the API contract, not only in a CDN dashboard someone forgets to open during an incident. If sales promises “US and India only,” that promise should be an `access_rules` field, not a wiki page.
- **Pagination and list discipline:** Default page sizes, hard maximums, and stable error JSON sound boring until an admin UI tries to load fifty thousand videos in one call. Build list endpoints for operators and automation, not for accidental full-table scans.

---

## 14. Practical Examples

- **SaaS course platform:** An instructor uploads from the browser over TUS because home networks are unreliable. The backend listens for both `video.asset.ready` and `video.asset.track.ready` because captions matter for accessibility and classroom compliance. The lesson page publishes only when both are ready. Playback is signed. Students never see storage URLs. Progressive download stays disabled.
- **Internal training portal:** HR drops masters onto an existing origin. A migration job creates videos with `source_url`. Errored events page IT with corrupt files instead of leaving silent gaps in the curriculum. Signed playback is default. Public policy is rare and reviewed. Soft-delete is used when courses retire so storage does not keep every obsolete all-hands forever.
- **Product demo library:** Marketing uploads large 4K demos with multipart ingest. High quality preset is used only when the source can honestly support it. The public site uses an embed player with storyboard scrub for sales pages. Demos remain signed because the content is competitive. Download endpoints correctly refuse plaintext masters.
- **Catalog publish microservice:** A small service subscribes only to `ready` and `errored`. On `ready`, it verifies HMAC, fetches playback, upserts a catalog row as playable, and enqueues search indexing. On `errored`, it writes a failure record and notifies the uploader. There is no polling loop on the critical path. Status polling exists only in the creator UI.
- **Multi-tenant SaaS with partner imports:** Each tenant gets project isolation and scoped keys. Partner systems use `source_url` imports during business hours and multipart for large drops overnight. Webhooks fan into a tenant-aware router that verifies signatures with per-project secrets. Dead letters are visible in an admin view so customer success can explain delays without guessing.

---

## 15. Performance Considerations

API latency should stay low because encode is async. If create or status endpoints slow down when the encode queue is deep, your control plane is coupled to the wrong work.

Progress granularity improves UX, but it should not require full GET payloads. A dedicated status resource exists for a reason.

Webhook fan-out must be durable. Your receiver should acknowledge quickly. Slow receivers create retry storms that look like platform outages.

Playback edge caching depends on stable segment paths plus an auth model that still validates at the edge. If every segment URL is unique per viewer forever, you will pay for origin traffic you did not need. If auth is missing, you will leak content.

Ladder cost dominates wall time and storage. Source-aware clamping prevents wasted rungs. That topic has its own deep guide; the API takeaway is simpler. Expose presets and max height at create time so product teams can choose cost and quality deliberately.

Status polling cadence should use backoff in user interfaces. Backends should prefer webhooks. A mobile client polling full objects every second is both a battery problem and an API abuse problem.

Delete and purge are async for a reason. Blocking HTTP on recursive storage deletes creates false timeouts and duplicate delete retries.

Measure the right things: time-to-ready by preset, webhook delivery success rate, playback unauthorized and conflict rates, cache hit ratio on segments, and errored ingest rate by path. Those metrics tell you whether the API contract is healthy.

---

## 16. Security Model

A self-hosted video API is a privileged system. Treat it like one.

Use scoped keys. Prefer `videos:read`, `videos:write`, `videos:delete`, `webhooks:read`, `webhooks:write`, and `analytics:read` over one god key pasted into a frontend bundle. Keep tenant isolation absolute. Every call should be project-scoped.

Upload tokens for TUS should be one-time and tenant-bound. `source_url` and webhook URLs need SSRF controls. Webhook signatures are mandatory before trust. Signed playback should be the default for private content. Direct bucket exposure should be architecturally impossible for normal playback.

Encrypted HLS keys must travel through the same gated path as segments. Soft-delete and purge support data minimization. When AI agents hold write scopes, destructive actions should be approval-gated and audited.

Ollanode's broader platform adds WAF controls and origin guards around the gateway. Even if you only adopt the video API slice first, keep defense in depth around authentication, egress, and playback.

---

## 17. Troubleshooting Reference

| Symptom | Likely cause | What to check |
| :--- | :--- | :--- |
| **Upload succeeds, player returns conflict** | Asset not ready yet | Status endpoint and `video.asset.ready` |
| **TUS upload ignored** | Bad or missing upload token | Create response token and tenant isolation behavior |
| **Multipart never processes** | Complete not called or bad ETags | Parts list and complete response |
| **Webhook appears missing** | Signature failure or non-2xx receiver | Delivery history and dead letters |
| **Signed play fails after a few minutes** | Token TTL or clock skew | Expiry timestamp and server time |
| **Public download returns forbidden** | Signed or encrypted asset | Expected restriction |
| **Empty or weak ladder** | Short source, preset, or max height | Metadata and create-time policy |
| **Stuck in processing** | Worker or reaper issue | Ops metrics, not an ad-hoc reprocess hammer |
| **Duplicate videos after retry** | Missing idempotency key | Create and finalize headers |
| **Catalog published twice** | Receiver not idempotent | Dedupe on event ID or video ID |

---

## 18. Best Practices

- **Create with policy first, then ingest:** Decide playback policy, quality preset, max height, encryption, and access rules at the moment you create the video record, before a single byte moves. Policy set at create time is explicit, auditable, and attached to the asset's identity. Policy bolted on later is a migration project and a security gap. If a video is meant to be signed and encrypted, that decision should exist in the create payload, not in a dashboard someone opens during an incident.
- **Pick the ingest path by network reality, not by the first snippet you found:** Presigned PUT, multipart, TUS, and pull-from-URL each solve a different failure mode. A mobile creator on a flaky connection needs resumable TUS. A backend migration pulling a back catalog needs `source_url`. A studio dropping an eight-gigabyte master needs multipart. A small admin upload can use a presigned PUT. The first tutorial you find will not match every case. Match the path to the network and the client, not to the snippet that was easiest to copy.
- **Drive product state from webhooks; use status for UX only:** Your catalog, publish pipeline, and operations should react to signed events such as `video.asset.ready` and `video.asset.errored`. Status polling is for progress bars and admin UIs, where a human is looking at a screen. If your backend's critical path is a polling loop, you are trading a durable event for a fragile timer and you will miss failures.
- **Verify webhook signatures on the raw body with a timing-safe compare:** Compute the HMAC over the exact raw request body you received, then compare against the signature header with a constant-time comparison. Never parse JSON before verifying, and never recompute over a re-serialized payload, because re-serialization changes the bytes and breaks the signature. A timing-safe compare prevents side-channel attacks that a naive string equality check invites.
- **Mint playback server-side per session:** Generate signed playback tokens in your backend for each viewer or session, with a short expiry, and hand them to the client only when it needs to play. Do not embed immortal tokens in emails, CMS fields, or public documentation. Short-lived tokens plus a refresh path on the control plane keep private content private and make token revocation meaningful.
- **Treat ready as the only publishable state:** `created`, `uploaded`, and `processing` are not playable. Only `ready` means a complete, gated playback package exists. Publishing on any earlier state produces broken players, racey lesson pages, and support tickets that look like player bugs but are really lifecycle bugs. Gate your catalog write on the `ready` event and nothing else.
- **Keep originals and derivatives inventoriable:** Every asset should be able to answer what bytes it occupies: the original master, HLS renditions, thumbnails, storyboards, transcripts, and clips. Inventory endpoints exist so finance can explain storage growth and compliance can prove retention policy. If you cannot list what an asset owns, you cannot delete it cleanly or bill for it honestly.

---

## 19. Common Mistakes

- **Publishing on `uploaded` instead of `ready`:** The most common lifecycle bug. `uploaded` means bytes landed in storage; it does not mean a playable package exists. Publishing on `uploaded` ships broken players and racey lesson pages. The fix is to gate every catalog write on the `ready` event and treat every earlier state as not publishable.
- **Putting API keys in browser playback paths:** A key in a frontend bundle or a mobile binary is a public credential anyone can extract. Playback should use short-lived, server-minted tokens, not raw API keys. If a key leaks from a client, you have no way to revoke it without breaking every user of that build.
- **Ignoring dead-lettered webhooks:** When a webhook exhausts its retries, it dead-letters. If nobody watches that queue, a broken receiver silently swallows every publish event. The failure is invisible until a customer asks why their video never went live. Monitor dead-letter counts weekly and treat them as a first-class alert.
- **Using one ingest path for every file size and network:** A single upload method cannot serve a mobile creator on a flaky connection and a studio dropping an eight-gigabyte master. Forcing everything through one path guarantees failures somewhere. Match the path to the network and the client: TUS for flaky browsers, multipart for large files, presigned PUT for small files, `source_url` for imports.
- **Expecting progressive MP4 for signed or encrypted videos:** A plaintext progressive download defeats gated HLS. Signed or encrypted assets should return forbidden on a download endpoint. If you need offline packages, design an explicit entitlement flow instead of accidentally inheriting one through storage URLs.
- **Polling full GET objects every second from a mobile client:** Polling the full video object on a tight interval is a battery problem, a bandwidth problem, and an API abuse problem. Use a dedicated status resource with backoff for UI progress, and let webhooks drive backend automation. Do not turn a mobile client into a polling loop.
- **Creating without idempotency and duplicating records after retries:** A retry without an idempotency key creates a second record and starts a second pipeline. The result is duplicate videos, double encodes, and a catalog that disagrees with itself. Attach idempotency keys to create and finalize so retries replay safely.

---

## 20. Alternatives and Comparison Tables

### Integration styles

| Approach | Pros | Cons |
| :--- | :--- | :--- |
| **Managed video API** | Fast start, hosted operations | Cost, residency, and policy constraints |
| **DIY ffmpeg plus S3 plus CDN** | Full control of components | You rebuild lifecycle, tokens, and webhooks |
| **Self-hosted video API** | Ownership plus real contracts | You operate the control plane |
| **Hybrid** | Controlled origin with burst encode | Two operational models to master |

### What to compare when evaluating APIs

| Criterion | Why it matters |
| :--- | :--- |
| **Explicit lifecycle states** | Prevents publish races |
| **Multiple ingest paths** | Real-world upload success |
| **Signed playback model** | Private VOD safety |
| **Webhook signing and retries** | Automation reliability |
| **Asset inventory** | Cost and compliance |
| **OpenAPI and scopes** | Safe multi-service access |
| **Clear VOD boundary** | Avoid live-scope surprises |
| **License** | Apache-2.0 versus AGPL traps for products |

Ollanode is a strong reference when you want that full contract under software you run: upload, async process, signed HLS playback, HMAC webhooks, and soft-delete lifecycle, without live or RTMP scope creep.

Managed platforms remain a rational choice when your team cannot operate workers and edge yet. DIY scripts remain a rational prototype. The self-hosted video API becomes the rational production choice when the contract itself is part of your product and ownership matters.

---

## 21. Enterprise and Cloud Deployment Notes

### Enterprise
Separate keys per environment and workload. An uploader key should not purge CDN zones. A readonly analytics key should not delete videos. Require webhook allowlists or additional network controls if policy demands it. Map errored rates to incident severity by customer tier. Gate destructive agent actions with approvals. Keep audit trails for create, delete, and policy changes. Decide retention with legal before the first enterprise customer asks for evidence. For enterprise architecture support, contact the team at Ollanode Enterprise.

### Cloud and hybrid
Run the API and workers in your VPC. Keep playback and CDN at the edge. Put object storage in the region your residency policy names. Use pull zones in front of playback origins and purge on delete or replace. Autoscale workers on queue depth, not on HTTP concurrency. Store webhook secrets in a real secret manager and rotate them. Watch origin shield behavior so a cache miss storm does not become an encode-adjacent outage.

### On-premises
The same API contract should hold behind different network boundaries. The point of a self-hosted video API is that application code should not care whether the control plane is in your cloud account or your datacenter. Only the lifecycle and signatures must behave the same. If your on-prem deployment needs different playback hostnames or internal DNS, keep those as configuration, not as a second product contract.

---

## 22. Frequently Asked Questions

### 1) What is a self-hosted video API?
A self-hosted video API is an authenticated control plane you run yourself to create video assets, ingest files, process them asynchronously into adaptive streams (typically HLS), return gated playback URLs, emit signed webhooks, and manage asset lifecycle until delete. It is not a bare transcoder CLI, not a public bucket with playlist files, and not a dashboard with no machine-readable contract.

### 2) How does upload work if bytes do not pass through the API?
The API creates a video record and mints an upload target such as a presigned URL, multipart part URLs, or a TUS token. The client uploads directly to storage. A finalize or complete call, or a TUS completion hook, starts processing. The design rule is that bytes never traverse the API host; the API only orchestrates. For a presigned PUT you upload the whole file to the minted URL and then call upload-complete with the observed size.

### 3) Should I poll status or use webhooks?
Poll status for UI progress. Use HMAC-signed webhooks such as `video.asset.ready` and `video.asset.errored` as the source of truth for backend publish and operations automation. Status polling is for progress bars and admin screens where a human is looking at the result. Webhooks are for your catalog, publish pipeline, and alerting, where a durable event must not be lost to a timer.

### 4) When is a video safe to play?
Only when lifecycle status is ready and playback endpoints stop returning conflict responses. Uploaded is not playable. Processing is not playable. `ready` means a complete, gated playback package exists, including the adaptive ladder, thumbnails, and any sidecar tracks. Publishing on any earlier state produces broken players and racey lesson pages.

### 5) What is the difference between signed and public playback?
Signed playback mints expiring tokens and gates manifests and segments through a playback host. Public playback can be shareable without a token, but still should not expose private bucket URLs. Encrypted or signed assets should not offer plaintext progressive download. In both cases the playback host proxies and rewrites every HLS URI through itself, sets an HttpOnly cookie scoped to the video so segment requests authenticate automatically, and serves AES-128 keys through the same gated path as media.

### 6) Which upload method should I choose?
Use presigned PUT for small and medium files, multipart for large files, TUS for flaky browser uploads, and `source_url` for server-side imports and migrations. Match the path to the network and the client, not to the first snippet you found. A mobile creator on an unreliable connection needs resumable TUS so a page reload does not restart the upload. A studio dropping an eight-gigabyte master needs multipart so a dropped part does not fail the whole file.

---

## 23. References

- Ollanode platform overview — the Apache-2.0, API-first, VOD-only self-hosted video platform used as the working reference throughout this guide. It exposes a project-scoped REST API for video, with async workers, signed HLS playback, HMAC webhooks, and an explicit asset lifecycle.
- **Videos and ingest** — the create-before-bytes contract, the four ingest paths (presigned PUT, multipart, TUS, and source_url), lifecycle states, and the status endpoint.
- **Processing and AI** — the async pipeline stages: validate, extract metadata, transcode, generate HLS, thumbnails, transcripts, store assets, emit webhook, mark ready.
- **Playback and delivery** — the signed versus public playback model, the manifest and HttpOnly cookie flow, sidecar tracks, and the progressive download restriction.
- **Webhooks** — the Mux-compatible event vocabulary, HMAC signature verification, retry schedule, and dead-letter behavior.
- **Authentication and scopes** — scoped API keys, project isolation, and least-privilege access for services and agents.
- How to Generate Dynamic HLS Resolution Ladders — the companion deep dive on source-aware ladder generation, no-upscaling, and preset selection that this guide references for the processing and performance sections.
- **HLS / Apple HTTP Live Streaming documentation** — the adaptive streaming protocol that defines master playlists, variant playlists, segments, and AES-128 encryption that the playback contract builds on.

---

## 24. Conclusion

A self-hosted video API is not ffmpeg with routes. It is a disciplined contract across five surfaces: upload, processing, playback, webhooks, and asset lifecycle. Create identity before bytes. Ingest through the path that matches the network. Process asynchronously. Gate playback on a real data plane. Notify with signed events. Retire assets with soft-delete and purge semantics your finance and compliance teams can live with.

If you keep those contracts explicit, your product code stays boring in the best way. Create the asset. Wait for ready. Play. Publish. That is the bar in 2026.

Ollanode is one working implementation of that bar—an Apache-2.0, API-first, VOD-only stack where the lifecycle is visible, the webhooks are verifiable, and the playback path does not accidentally become a public bucket. Use it as a reference architecture, or as the control plane you actually run.

---

## Related Engineering & Architecture Guides

For deeper technical implementations, explore these related platform resources:

- [Best Open Source Video Infrastructure](/blog/best-open-source-video-infrastructure-in-2026-top-options-for-startups-and-midmarket-teams)
- [How to Generate Dynamic HLS Resolution Ladders](/blog/how-to-generate-dynamic-hls-resolution-ladders)
- [Multi-Tenant Self-Hosted Video Platform](/blog/multi-tenant-self-hosted-video-platform-isolation-quotas-access-control-and-billing)
- [OllaNode Platform Features](https://ollanode.com/#platform-capabilities)

