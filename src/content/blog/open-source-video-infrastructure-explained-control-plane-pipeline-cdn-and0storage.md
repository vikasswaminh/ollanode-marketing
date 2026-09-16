---
title: 'Open Source Video Infrastructure Explained: Control Plane, Pipeline, CDN, and Storage'
seoTitle: 'Open Source Video Infrastructure Explained: Control Plane, Pipeline, CDN & Storage'
description: 'A practical 2026 guide to open source video infrastructure—control plane, VOD pipeline, CDN, and storage—with architecture, workflows, security, and how Ollanode fits.'
category: 'Video & CDN'
pubDate: 2026-09-02
author: 'The OllaNode Team'
tags: ['Video & CDN', 'Open Source', 'Video Infrastructure', 'Control Plane', 'VOD', 'HLS', 'Storage', 'CDN', 'Apache-2.0']
---

Most teams do not fail at video because they cannot run ffmpeg. They fail because they treat video as a single service when it is actually four coupled systems: a control plane that accepts intent, a pipeline that turns bytes into adaptive streams, storage that keeps originals and derivatives durable, and a CDN that absorbs playback traffic without leaking private origins.

Managed platforms hide that split behind one upload button. Open source video infrastructure makes the split visible — and that visibility is the point. Once you can name each layer, you can size it, secure it, observe it, and replace one piece without rewriting your product.

This guide explains open source video infrastructure the way production teams actually operate it in 2026. It is not a product launch post, not a billing rant, and not a first-pipeline quickstart. It is an architecture brief: what each layer owns, how requests and jobs move, where systems break, and how a unified stack like Ollanode keeps those layers under one OpenAPI control plane while remaining VOD-first, HLS-first, and ownership-first.

---

## Quick Answer: What Is Open Source Video Infrastructure?

| Question | Quick answer |
| :--- | :--- |
| **What is it?** | Software you run yourself that provides API-driven VOD ingest, async processing, adaptive HLS delivery, object storage, and edge/CDN caching — with source code and licensing you can audit and ship commercially. |
| **What are the four core layers?** | Control plane (API/orchestration), pipeline (validate → transcode → package), storage (S3-style originals + derivatives), CDN/edge (pull zones, purge, signed delivery). |
| **How is it different from “ffmpeg + S3”?** | A platform has tenancy, auth scopes, job status, webhooks, playback tokens, purge, and ops surfaces. Scripts have none of that until you invent them. |
| **VOD or live?** | Serious open source stacks often start VOD-only. Live/RTMP is a different contribution and ops problem. Ollanode is VOD-only today. |
| **Why open source matters here?** | You need inspectable media paths, predictable cost, residency control, and commercially safe licensing (Apache-2.0 beats AGPL traps for product companies). |
| **Biggest mistake?** | Buying or assembling “infrastructure” that has workers and buckets but no real control plane — then discovering retries, tokens, and purge are your unpaid product. |

Open source video infrastructure is the ownership model for teams that outgrew black-box SaaS defaults but refuse to live inside a fragile glue layer forever. The winning shape in 2026 is one control plane coordinating pipeline, storage, and CDN — not four vendors and a spreadsheet of secrets.

<div class="key-takeaways-box" id="key-takeaways">
  <div class="key-takeaways-header">
    <span class="key-takeaways-icon">✦</span>
    <h3 class="key-takeaways-title">KEY TAKEAWAYS</h3>
  </div>
  <ul class="key-takeaways-list">
    <li><strong>Four layers, one product surface:</strong> Control plane, pipeline, storage, and CDN must be designed as a system, not as unrelated tools.</li>
    <li><strong>The control plane is the product:</strong> Auth, tenancy, asset lifecycle, policy, webhooks, and audit decide whether engineers can automate video safely.</li>
    <li><strong>The pipeline must be async:</strong> Validate → extract metadata → transcode → generate HLS → thumbnails/transcripts → store → webhook → mark ready. Never encode inside the HTTP request.</li>
    <li><strong>Storage is two jobs:</strong> Durable media inventory for the VOD pipeline, plus developer-facing S3-style zones for app assets and image transforms.</li>
    <li><strong>CDN is not optional at scale:</strong> Private playback origins plus pull-zone caching, hotlink signing, and purge are what keep private content private and public traffic cheap.</li>
    <li><strong>Source-aware ladders beat fixed ladders:</strong> Cap renditions at native resolution; do not invent 4K from a 720p upload.</li>
    <li><strong>Open source only helps if licensing and ops are production-shaped:</strong> Apache-2.0, clear VOD boundaries, and observable workers matter more than a demo encode.</li>
    <li><strong>Ollanode is a concrete reference architecture:</strong> [Rust and NATS transcoding workers](/blog/building-production-grade-hls-transcoding-pipeline-rust-nats)/Axum control plane, NATS JetStream workers, SeaweedFS/S3 storage, OpenResty pull zones, signed HLS playback, and agent-aware governance — without live/RTMP scope creep.</li>
  </ul>
</div>

---

## 1. Problem Statement: Why Video Infrastructure Became a Category

In 2026, video is product surface area. It is onboarding, course content, support libraries, compliance evidence, sales demos, and internal knowledge. The moment video stops being a marketing widget, three pressures arrive together.

**Cost pressure.** Metered encode minutes and egress look fine in a prototype and hostile in a catalog. Finance cannot forecast a quarter if every feature launch that adds video also adds an opaque usage spike.

**Control pressure.** Product teams need source-aware ladders, short-lived playback tokens, country/referrer rules, retention policy, and webhook-driven publish flows. Black-box defaults work until your catalog is mostly screen recordings, or security asks where keys live, or legal asks which region holds the masters.

**Operational pressure.** DIY stacks usually start as “S3 + ffmpeg workers + Cloudflare + a status table.” That glue becomes the product: stuck jobs, bad manifests, purge mistakes, token edge cases, and silent webhook failures. Teams then search for open source video infrastructure because they want SaaS-grade APIs with ownership-grade control.

The category exists because “can we encode?” is no longer the hard question. The hard question is whether control plane, pipeline, storage, and CDN are coherent enough that your application can treat video as a reliable backend capability.

---

## 2. A Short History: From DIY Glue to Open Platforms

Most engineering orgs follow the same arc:

1. Embed a managed player/API and ship fast.
2. Hit pricing, residency, or policy limits.
3. Assemble DIY pieces: object storage, encoder VMs, CDN, signed cookies, a homemade job table.
4. Discover the glue is the unpaid product.
5. Look for an open, API-first platform that restores a clean contract without giving ownership away.

That arc is why commercially permissive stacks matter. Apache-2.0-friendly platforms made self-hosted video viable for product companies that cannot absorb AGPL risk into their shipping surface. Ollanode sits in that wave as a unified control plane for video, storage, CDN, DNS, and edge — so teams stop re-assembling the same four layers under deadline pressure.

What changed technically is not that ffmpeg got better (it did). What changed is that production teams now expect the same primitives they already demand from cloud platforms: OpenAPI contracts, scoped keys, async jobs, signed delivery, purge, webhooks, and audit.

---

## 3. Definition: Open Source Video Infrastructure

**Definition:** Open source video infrastructure is deployable software, released under an inspectable open-source license, that provides an API-driven control plane for video-on-demand ingest, asynchronous media processing, adaptive playback packaging (commonly HLS), durable object storage, and CDN/edge delivery — operated on infrastructure you own or control.

### What it is

- A productized media backend with auth, tenancy, and stable APIs
- A pipeline that turns one upload into playable adaptive streams and side assets
- A storage model for originals, renditions, posters, transcripts, and app files
- A delivery path with origin protection, caching, and purge
- An ops surface: status, metrics, retries, webhooks, audit

### What it is not

- A single ffmpeg cron job on a VM
- A generic bucket with progressive MP4 links
- A CDN alone, or a CMS alone
- A live contribution/encoder farm unless explicitly designed for live
- “Open core” marketing with the critical playback path locked behind a proprietary gate

### Citation-ready one-liner

> Open source video infrastructure lets your application upload, process, store, and stream VOD through APIs and systems you can inspect and operate, instead of depending on a fully metered third-party media SaaS for the entire path.

---

## 4. Architecture: The Four Layers That Must Work Together

Think in planes, not tools. Open source video infrastructure works when four layers share one contract instead of living as unrelated products.

Users, apps, and agents send requests through a REST/OpenAPI gateway. That gateway is the front door into the control plane, which owns authentication, policy, job orchestration, webhooks, and audit. The control plane does not encode video itself. It decides what should happen, who is allowed to request it, and how progress is reported.

From the control plane, work fans out in two directions. Storage holds the durable bytes: S3-style zones, original uploads, HLS outputs, posters, and transcripts. The pipeline runs the heavy lifting in async workers: validate the media, extract metadata, transcode the adaptive ladder, package HLS, generate thumbnails and transcripts, then store the finished assets.

Delivery closes the loop through the CDN and edge layer. Pull zones, signed hotlink protection, the playback host, purge controls, and edge rules sit here so viewers receive streams quickly without private origins being exposed as the public API. In short: intent enters through the control plane, processing and persistence happen in pipeline and storage, and CDN/edge is what viewers actually touch.

### Why the split matters

If you collapse everything into “we run ffmpeg and put files in S3,” you lose the seams where production systems fail:

- API latency under encode load
- Token expiry vs cache TTL mismatches
- Multi-tenant isolation mistakes
- Purge after re-encode or takedown
- Webhook retries and dead letters
- Agent actions without approval gates

Ollanode’s public architecture follows this model explicitly. Users and apps hit an API gateway. A Rust/Axum control plane orchestrates work. Storage and async workers fan out in parallel. OpenResty pull zones deliver back to viewers. The important line is not “we encode video.” It is “one control plane dispatches storage and processing, then edge delivery closes the loop.”

---

## 5. Internal Working: Request Path vs Job Path

Production video systems have two clocks.

### Request path (must stay fast)

- Authenticate caller and scope
- Create asset / mint upload URL / fetch status / issue playback token
- Persist intent in the database
- Enqueue work
- Return quickly with IDs and status

### Job path (may take minutes)

- `upload_completed`
- `validate`
- `extract_metadata`
- `transcode`
- `generate_hls`
- `thumbnails`
- `transcript` (optional / config-gated)
- `store_assets`
- `emit_webhook`
- `mark_ready`

Ollanode’s VOD pipeline uses exactly this shape. Long-running work runs in worker pools over NATS JetStream (with optional Temporal for durable workflows). The HTTP handler never waits for a 4K ladder. Your app either polls status or waits for HMAC-signed webhooks such as `video.asset.ready` and `video.asset.errored`.

### Asset lifecycle

`created` → `upload_pending` → `uploaded` → `processing` → `ready` | `errored`

If a platform cannot show you this lifecycle cleanly, it is not infrastructure yet. It is a script farm with optimism.

---

## 6. Layer 1 — Control Plane

The control plane is the brain. Everything else is muscle and plumbing.

### What the control plane owns

- API keys, roles, and fine-grained scopes
- Project/tenant isolation
- Asset records and playback policy
- Job dispatch and status
- Webhook registration and delivery history
- Quotas, idempotency, request IDs
- Audit and (when relevant) agent approval gates

### Why developers feel it first

Your application should never talk directly to ffmpeg, object-store internals, or CDN config files. It should call a stable contract:

- `POST /v1/videos`
- upload completion hooks
- `GET /v1/videos/{id}/status`
- playback URL issuance
- storage-zone and CDN-zone management
- purge and policy updates

In Ollanode terms, that contract is OpenAPI 3.1 with bearer/API-key auth, coarse and fine scopes (`videos:write`, `zones:purge`, `storage:write`, and so on), idempotency keys, rate limits, and stable error JSON. Roles typically look like owner / admin / member / viewer, with true per-project isolation.

### Control plane quality tests

Ask these before you trust any stack:

- Can two tenants ever see each other’s assets by ID enumeration?
- Are destructive actions scoped and auditable?
- Do webhooks retry with backoff and dead-letter visibility?
- Can an AI agent call the same API without getting unrestricted delete/deploy powers?
- Does every request carry a correlation ID into worker logs?

Ollanode’s agent model is a useful stress test for control-plane maturity: normal reads/uploads can be allowed, destructive or code-deploy actions return 202 for human approval, and admin/billing paths stay denied, with a tamper-evident hash-chain audit and a kill switch. Even if you never enable agents, that design forces clean capability boundaries.

### What “unified” should mean

Unified does not mean one giant binary with no seams. It means one policy and identity system across video, storage, CDN, DNS, and edge functions. Fragmented stacks fail here: five vendors, five auth models, five audit stories, and no single place to answer “who changed playback policy at 14:03?”

---

## 7. Layer 2 — Pipeline

The pipeline is the media factory. One upload should become a full playable package.

### Ingest paths that belong in a real platform

| Method | Best for |
| :--- | :--- |
| **Presigned PUT** | Small/medium files |
| **S3-style multipart** | Large files |
| **Resumable TUS** | Browser uploads / flaky networks |
| **Pull-from-URL (`source_url`)** | Importing existing remote media |

Create-time controls should include at least:

- `playback_policy`: `signed` (default) or `public`
- `quality_preset`: e.g. `low` / `standard` / `high` / advanced codec tier
- `max_height`
- optional `encrypt`
- access rules (country / referrer)

### Stage-by-stage meaning

#### validate
Reject corrupt or unsupported media before you burn encode capacity.

#### extract_metadata
Read duration, codecs, resolution, fps, bitrate, audio presence. This is where source-aware ladder logic begins.

#### transcode
Build the adaptive ladder. In a sane default, that means H.264 for compatibility, optional H.265/NVENC or SVT-AV1 as config-gated tiers, and a hard no-upscale rule so a 720p source never invents 1080p/4K.

#### generate_hls
Package master + variant playlists and segments. A practical packaging split used by Ollanode's video pipeline: CMAF/fMP4 (`.m4s`) for non-encrypted output; MPEG-TS (`.ts`) with `#EXT-X-KEY` when AES-128 encryption is on. HLS is the shipping protocol today; CMAF segments keep a future DASH manifest path open.

#### thumbnails
Poster, sampled frames, storyboard sprite + WebVTT for hover scrub.

#### transcript
Word-level speech-to-text (WhisperX-style) into VTT/SRT, with optional diarization and later AI metadata only when explicitly enabled.

#### store_assets / emit_webhook / mark_ready
Persist outputs, notify downstream systems, open playback.

### Pipeline design rules that prevent outages

- Workers scale independently from the API.
- Reapers/redispatch exist for stuck jobs.
- Failures distinguish validate errors from encode errors.
- Webhook names are stable enough to automate against (`video.asset.ready`, `video.asset.errored`, thumbnail/track events).
- Ladder policy is evidence-based, not “always 360p–4K for every file.”

For rung theory and verification, use the dedicated ladder guide: How to Generate [dynamic HLS resolution ladders](/blog/how-to-generate-dynamic-hls-resolution-ladders) Resolution Ladders. This article stays at the infrastructure layer: the pipeline must expose policy knobs and prove them in manifests, not hide encoding as magic.

---

## 8. Layer 3 — Storage

Storage is where teams under-design and overpay.

### Two storage jobs, one philosophy

| Storage type | Purpose |
| :--- | :--- |
| **Pipeline media storage** | Source masters, HLS assets, MP4/MP3 derivatives, posters/sprites, transcripts |
| **Developer storage zones** | Project-scoped S3-style buckets for site assets, user files, downloads, creatives |

They share an ownership model, but they are not the same product surface. A platform that only “puts encodes somewhere” still forces you to bolt on a second object store for the rest of the app.

### What good storage APIs look like

- Create/list/delete storage zones
- Presigned PUT for direct upload (bytes bypass your app server)
- List/delete objects with quotas and `bytes_used`
- Temporary signed GET when needed
- Ability to front a zone with a CDN pull zone
- Optional on-the-fly image optimizer (resize/format/quality) via signed URLs

Ollanode’s storage model follows that pattern with SeaweedFS-backed S3-style zones and imgproxy for transforms — for example turning a heavy JPEG into a much smaller WebP/AVIF derivative without a separate image CDN vendor.

### Storage decisions that affect video specifically

- **Origin privacy:** Playback must not expose raw private bucket URLs as the public contract.
- **Layout discipline:** Predictable prefixes for source, renditions, storyboards, and captions make purge and lifecycle possible.
- **Quota enforcement:** Multi-tenant platforms die quietly when one project fills the disk.
- **Lifecycle policy:** Hot HLS segments, warm masters, cold rarely accessed archives — decide deliberately.
- **Checksums and integrity:** Especially for multipart and resumable uploads.

---

## 9. Layer 4 — CDN and Edge Delivery

Encoding creates options. CDN makes those options affordable and fast.

### Playback path

A credible private VOD path looks like this:

1. App decides entitlement.
2. Control plane issues a short-lived playback token.
3. Playback host rewrites HLS URIs through itself.
4. An HttpOnly cookie or equivalent binds subsequent segment requests to that session.
5. CDN edges cache segments while still respecting auth semantics.
6. AES keys, if used, travel through the same gated path.

Bytes should never stream as a permanent public deep link into a private bucket. Ollanode’s pull-zone CDN and edge delivery model is built around that rule: signed, expiring HMAC tokens; playlist rewriting; cookie-scoped segment access; optional AES-128; sidecars for subtitles, chapters, and storyboards; embeddable player support when you want it.

### Pull-zone capabilities that matter

- Map hostname → origin URL or storage zone
- Per-zone TTL, CORS, cache-bypass paths
- Ordered edge rules (header/redirect/block)
- Hotlink token signing (`exp` + token)
- Full purge and path-granular purge
- Live analytics: requests, bytes, hit/miss ratio
- Visible cache status headers for debugging

### Edge compute belongs next to delivery

Once CDN is in the same control plane, edge functions stop being a separate product science project. Practical uses:

- signing helpers
- geo or entitlement pre-checks
- BFF endpoints
- feature flags via KV
- cron warmers
- OG/metadata helpers

Ollanode runs JS/TS in V8 isolates with secrets, rate limits, rollback, and egress isolation. Whether you use that on day one or not, the architectural point stands: delivery policy and edge logic should share identity with the video API.

### DNS as the quiet multiplier

Authoritative DNS beside CDN zones reduces vendor sprawl for customer domains. It is not mandatory to call a stack “video infrastructure,” but it is how unified platforms remove one more brittle handoff. Hickory-backed DNS in Ollanode is an example of that consolidation: API writes, fast propagation, records living next to the same project model.

---

## 10. End-to-End Workflow

### Viewer-facing happy path

1. Your app authenticates the end user and checks entitlement.
2. Backend creates or selects a video via the control plane.
3. Client uploads (presigned / multipart / TUS) or the platform pulls `source_url`.
4. Pipeline runs asynchronously to ready.
5. Backend requests a signed playback session.
6. Player loads the HLS master through the playback host.
7. First viewers miss at the edge; later viewers hit cache.
8. Your systems react to webhooks to publish into the product catalog.

### Operator workflow

- Watch queue depth and worker saturation
- Separate validate failures from encode failures
- Inspect master playlists after ladder/policy changes
- Purge CDN paths after re-encode or takedown
- Rotate keys and review access logs
- Tune presets by content class (courses vs cinematic demos)

### Automation workflow

CI can validate rung counts and `BANDWIDTH` / `RESOLUTION` tags. Product backends should treat `video.asset.ready` as the publish signal, not a sleep timer after upload. Agents, if enabled, should use the same OpenAPI surface with approval gates on destructive actions.

---

## 11. Configuration Patterns That Matter

Configuration is where a platform proves it is product-ready.

### Playback policy
Default to `signed` for anything non-public. `public` is fine for marketing clips. It is wrong for paid courses, internal training, and customer private media.

### Quality presets and caps
Expose presets and `max_height` so product code can choose economics per upload class. Source-aware clamping should be a hard rule, not a blog claim.

### Encryption
AES-128 HLS is a practical control when key URIs are gated. Know the packaging trade-off: encrypted paths often use MPEG-TS; clear CMAF/fMP4 stays more DASH-friendly for the future.

### Access rules
Country and referrer gates belong in the platform path, not only in your app server. App checks are necessary; origin/edge enforcement is defense in depth.

### Webhook endpoints
Require HTTPS, verify HMAC signatures, handle retries idempotently, and monitor dead letters. Delivery history is an ops feature, not a nice-to-have.

### Example: create with explicit policy

```bash
curl -X POST https://api.ollanode.com/v1/videos \
  -H "Authorization: Bearer $OLLANODE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "q3-product-demo.mp4",
    "playback_policy": "signed",
    "quality_preset": "standard",
    "max_height": 1080,
    "encrypt": false
  }'
```

### Example: storage zone + CDN fronting intent

```bash
# create a zone for app assets
curl -X POST https://api.ollanode.com/v1/storage-zones \
  -H "Authorization: Bearer $OLLANODE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name":"site-assets"}'

# later: mint a presigned PUT, upload directly, attach a pull zone hostname
```

---

## 12. Practical Examples

### Example A — SaaS product demo library
- **Need:** Private demos for logged-in accounts, predictable cost, webhook-driven “publish to docs.”
- **Layer emphasis:** Signed playback + async pipeline + webhook automation.
- **Config posture:** `playback_policy=signed`, standard ladder capped at 1080p, no public MP4 download.
- **Why open infrastructure:** Demo volume grows with sales hiring; metered encode/egress becomes a tax on go-to-market.

### Example B — EdTech course platform
- **Need:** Large catalog of screen recordings, captions, mobile-heavy ABR, residency options.
- **Layer emphasis:** Source-aware ladders (often no 4K), transcripts, CDN hit ratio, tenancy.
- **Config posture:** Narrower ladders for lectures, strong 720p/1080p text legibility, signed playback by default.
- **Failure mode to avoid:** Fixed 360p–4K ladders that upscale webcam lectures and waste storage.

### Example C — Internal training portal
- **Need:** VPC/on-prem deployment, auditability, strict sharing rules.
- **Layer emphasis:** Control plane scopes, access logs, origin guard, purge after takedown.
- **Config posture:** Signed + referrer/country rules as needed, shorter token TTLs, no public zones.
- **Why unified storage/CDN matters:** Internal IT will not happily operate five media vendors for one LMS.

### Example D — Media archive with public highlights
- **Need:** Mostly private masters, some public highlight clips, image derivatives for catalogs.
- **Layer emphasis:** Storage zones + image optimizer + mixed playback policies.
- **Config posture:** Public only on explicitly marked assets; everything else signed/encrypted.
- **Ops note:** Path purge must be trustworthy when a “public highlight” is revoked.

---

## 13. Performance Considerations

### Encode plane
- CPU H.264 is enough to validate architecture.
- GPU H.265/NVENC becomes relevant at sustained volume.
- AV1 tiers are catalog economics decisions, not day-one defaults.
- Wider ladders multiply cost linearly; measure rung request share before expanding.

### API plane
- p95 API latency should stay stable while encode queues grow.
- Backpressure belongs in queues, not in upload HTTP timeouts.
- Idempotency keys prevent double-create storms from client retries.

### Delivery plane
- Segment size and playlist design affect rebuffering more than raw peak bitrate claims.
- Cache key design must not accidentally partition identical segments into misses.
- Token TTL and CDN TTL must be designed together.
- Watch hit ratio by zone and by path prefix (HLS segments vs posters vs captions).

### Practical benchmark set

- 720p screen recording
- 1080p talking head
- High-motion 1080p/4K trailer
- Long-form lecture (45–90 minutes)
- Corrupt/unsupported file (negative path)

**Measure:** time to ready, rung count vs source height, manifest bandwidth accuracy, first-play latency from cold edge, second-play hit behavior, and webhook delivery delay.

---

## 14. Security Model

Video security fails in boring ways: public bucket listings, immortal signed URLs, SSRF on pull-from-URL, webhook endpoints that accept anything, and admin keys copied into frontend bundles.

### Minimum viable controls

- Scoped API keys; no global god-keys in app servers if project keys suffice
- Signed playback by default for non-public content
- Short TTLs; refresh via backend entitlement checks
- Origin guard so CDN/playback is the front door
- Hotlink signing for non-HLS assets when needed
- SSRF vetting on outbound fetch and webhook URLs
- WAF in front of public API/edge surfaces
- Audit logs for policy changes, deletes, purges, and key actions

### Defense in depth around Ollanode-shaped stacks

- Coraza WAF + OWASP CRS style protections
- Playback token/cookie gating
- AES-128 as an additional stream control, not a substitute for auth
- Agent approval digests for destructive actions
- Tamper-evident audit hash chains
- Kill switch for agent traffic

### Tenancy checklist

- Object keys are not guessable across tenants
- Playback tokens are bound to video/project context
- Purge and delete require explicit scopes
- Storage zone delete is catastrophic and should be gated

Security is not a separate product chapter. It is how the four layers refuse to trust each other blindly.

---

## 15. Troubleshooting Reference

| Symptom | Likely layer | What to check |
| :--- | :--- | :--- |
| **Upload succeeds, asset never leaves processing** | Pipeline / orchestration | Worker saturation, stuck job reaper, NATS/Temporal health, validate vs encode error logs |
| **ready but player fails on master playlist** | Playback / CDN | Token expiry, playlist rewrite host, CORS, HTTPS mixed content |
| **Only first segment plays** | CDN / auth cookie | Cookie scope/path, cache key ignoring auth incorrectly, mid-playlist 401/403 |
| **Soft/fake-looking 1080p from webcam source** | Pipeline policy | No-upscale clamping, ladder override, source metadata height |
| **Spiky origin traffic after deploy** | CDN | TTL, bypass paths, purge storm, cache status headers |
| **Webhook “missed” events** | Control plane | Signature verification bugs, non-idempotent handlers, dead-letter queue |
| **Disk fills unexpectedly** | Storage | Per-project quotas, abandoned multipart uploads, oversized ladders |
| **Public access to “private” demo** | Policy | `playback_policy`, immortal URL minting in app code, bucket ACL mistake |

### Fast incident order

1. Confirm asset status and last pipeline stage.
2. Fetch master playlist with a fresh token.
3. Inspect `BANDWIDTH` / `RESOLUTION` and key URI behavior.
4. Check edge HIT/MISS and origin status codes.
5. Verify webhook delivery history before reprocessing blindly.

---

## 16. Best Practices

1. **Design the control plane first.**  
   Start with auth, tenancy, asset lifecycle, job status, webhooks, and audit. If the API contract is vague, every other layer becomes tribal knowledge that only one engineer understands.

2. **Keep the request path thin.**  
   Uploads, status checks, and playback URL minting should stay fast even when the encode queue is deep. Encode capacity should scale independently without degrading product UX.

3. **Default to signed playback.**  
   Private-by-default tokens force intentional product decisions. Make public delivery an explicit policy choice, not the accidental default of open bucket URLs.

4. **Use source-aware ladders.**  
   Cap renditions at native resolution and tune rungs by content class (talking head, screen share, cinematic). Do not invent 4K from a 720p upload.

5. **Separate pipeline storage from app storage zones.**  
   Media masters, HLS outputs, posters, and transcripts have different retention and access patterns than app uploads. Keep lifecycles separate under the same ownership model.

6. **Put CDN in the same identity system.**  
   Purge, edge rules, signed hotlink, and analytics should be first-class API operations under the same tenancy and auth scopes as ingest and jobs.

7. **Verify manifests, don’t trust config.**  
   After preset or ladder changes, fetch real master/media playlists and confirm bandwidth, resolution, codecs, and key URIs. Config that “looks right” still ships broken streams.

8. **Treat webhooks as the integration spine.**  
   Product publish flows depend on reliable job events. Require signature checks, idempotent consumers, retries, and dead-letter alerts — not fire-and-forget callbacks.

9. **Measure hit ratio and rung popularity.**  
   Cost hides in unused renditions and origin pulls. Track CDN hit ratio, popular ladder rungs, and re-encode rates so you can prune waste with evidence.

10. **Document VOD boundaries honestly.**  
    If you do not do live/RTMP, say so in docs and sales conversations. Buyers respect clear scope more than feature theater that inflates ops risk.

---

## 17. Common Mistakes

1. **Calling a script farm a platform.**  
   A pile of ffmpeg workers and S3 buckets is not infrastructure. Without tenancy, tokens, purge, webhooks, and job status, you still own an unpaid control plane.

2. **Encoding inside the upload request.**  
   Synchronous encode guarantees timeouts, gateway failures, and outages under load. Always accept, queue, process asynchronously, then notify.

3. **Fixed ladders for every source.**  
   One ladder for all uploads wastes compute and storage and creates dishonest “4K” outputs from lower-resolution sources. Source-aware caps are non-negotiable.

4. **Public bucket URLs as playback.**  
   Direct object URLs work in staging and fail in production: hotlinking, compliance reviews, token expiry, and takedown all break without signed delivery.

5. **CDN bolted on with no purge story.**  
   Re-encodes, caption fixes, and legal takedowns leave haunted caches if purge is manual or missing. CDN without API purge is incomplete delivery.

6. **One god API key.**  
   A single all-powerful key eventually lands in a frontend, CI log, agent session, or contractor laptop. Scope keys by tenant, environment, and capability.

7. **Ignoring audio and captions.**  
   “Video infra” that cannot ship clean audio tracks and VTT/SRT forces side systems and broken accessibility. Captions and audio are part of the pipeline, not extras.

8. **License blindness.**  
   AGPL and similar traps show up after legal review, not during the demo. Choose commercially shippable licenses early (Apache-2.0 is the safer default for product companies).

9. **Live-feature theater.**  
   Paying complexity for RTMP/live when the real product is VOD courses, demos, or libraries burns roadmap and ops budget. Ship VOD well before expanding scope.

10. **No negative-path testing.**  
    Corrupt files, truncated uploads, expired tokens, and webhook retries are production traffic too. If you only test happy paths, production becomes your test suite.

---

## 18. Alternatives and Comparison Tables

### Architectural alternatives

| Approach | Pros | Cons | Best fit |
| :--- | :--- | :--- | :--- |
| **Managed media SaaS** | Fast start, less ops | Metered cost, weaker residency/control | Early prototypes, low catalog risk |
| **DIY glue (S3 + ffmpeg + CDN)** | Flexible | You build the control plane yourself | Short experiments only |
| **Open source video infrastructure (unified)** | Ownership + API coherence | You operate it | Productized VOD with cost/control pressure |
| **Best-of-breed open tools, self-integrated** | Component choice | Integration tax forever | Teams with a dedicated media platform crew |

### Layer completeness checklist

| Capability | DIY glue | Typical managed SaaS | Ollanode-style open stack |
| :--- | :--- | :--- | :--- |
| **OpenAPI control plane** | Homegrown | Yes | Yes |
| **Async VOD pipeline** | Partial | Yes | Yes |
| **Source-aware HLS ladders** | DIY | Often fixed/opaque | Configurable, no upscale |
| **Signed playback** | DIY | Yes | Yes |
| **S3-style app storage zones** | External | Sometimes | Yes |
| **Pull-zone CDN + purge** | External | Often bundled/partnered | First-class |
| **Edge functions + KV** | External | Varies | First-class |
| **Agent governance** | Rare | Rare | First-class |
| **Live/RTMP** | DIY/extra | Often yes | No (VOD-only boundary) |
| **License** | N/A | Proprietary | Apache-2.0 oriented stack |

### When not to choose open infrastructure

- You need live contribution tomorrow.
- You have no one to own on-call for media workers.
- Your catalog is tiny and fully public with no policy needs.
- You are still validating whether video matters to the product at all.

Open source is leverage, not a personality trait. Use it when ownership value exceeds operating cost.

---

## 19. Enterprise Deployment

Enterprise buyers usually ask the same four questions: residency, tenancy, audit, and failure behavior.

### Residency and network posture

- Deploy in the required region/VPC
- Keep private origins off the public internet except through playback/CDN doors
- Control egress for pull-from-URL and webhook delivery
- Separate prod/stage projects with real key isolation

### Tenancy

- Per-project isolation for assets, storage zones, CDN zones, and functions
- Fine-grained scopes for break-glass operations
- Quotas so one customer cannot starve encode or disk

### Audit and change control

- Who minted a public playback policy?
- Who purged a path?
- Who deleted a zone?
- Which agent action waited on approval?

### Failure behavior

Enterprises care less about perfect uptime slides and more about:

- what happens when workers die mid-ladder
- whether redispatch is safe
- whether purge is deterministic
- whether webhook dead letters are visible

Ollanode’s orchestration shape — domain core without IO, JetStream workers, optional Temporal, background redispatch/reaper — is aimed at those failure modes rather than demo-path success alone.

---

## 20. Cloud and Hybrid Deployment

Open source video infrastructure does not require a medieval on-prem aesthetic. Common patterns:

- **Pattern 1 — Single-region cloud VPC:** API + DB + workers + storage in one region; CDN pull zones globally. Simplest ownership win.
- **Pattern 2 — Hybrid:** Control plane and workers in your cloud account; storage in a region-locked bucket; CDN at the edge. Useful for regulated content with public playback needs.
- **Pattern 3 — On-prem core, cloud burst:** Keep masters and API on-prem; burst encode workers when queues spike. Only works if the control plane already treats workers as ephemeral capacity.
- **Pattern 4 — Multi-env promotion:** Stage and prod as separate projects/clusters. Promote config (ladder presets, CDN rules) deliberately; never “share a bucket for convenience.”

### Capacity planning starter

| Resource | Scale signal |
| :--- | :--- |
| **API nodes** | Request rate, p95 latency |
| **Workers** | Queue depth, time-to-ready |
| **Storage** | Bytes used, growth per ready asset |
| **CDN** | Origin request rate, hit ratio, purge rate |
| **DB** | Asset/job write amplification |

Own the signals even if you buy some of the capacity.

---

## 21. Frequently Asked Questions

### 1) What is open source video infrastructure?
It is deployable open-source software that gives you an API-driven control plane for VOD ingest, async transcoding/packaging, storage, and CDN/edge delivery on infrastructure you operate. It is broader than an encoder and stricter than a pile of scripts.

### 2) What is a video control plane?
The control plane is the orchestration and policy layer: authentication, tenancy, asset records, job dispatch, playback policy, webhooks, and audit. Applications talk to the control plane; workers and CDN enforce what it decides.

### 3) How does a VOD pipeline differ from “just transcoding”?
Transcoding is one stage. A VOD pipeline includes validation, metadata extraction, ladder encode, HLS packaging, thumbnails/transcripts, durable storage, webhook notification, and readiness marking — usually asynchronously.

### 4) Do I need a CDN if I already have storage?
At low traffic, maybe not. At real traffic or private content scale, yes. A CDN reduces origin load and latency, while a proper playback path prevents private storage URLs from becoming your public API.

### 5) Is open source video infrastructure suitable for enterprise security requirements?
It can be, if the stack includes scoped auth, signed playback, origin protection, audit logging, SSRF controls, and tenant isolation. “We self-host ffmpeg” is not a security model. Platform controls are.

### 6) Should an open source stack include live streaming?
Only if your product needs it. Live/RTMP is a different ops and protocol domain. Many teams are better served by a strong VOD-only boundary. Ollanode, for example, is VOD-only today and ships HLS rather than pretending live is a checkbox.

### 7) How do storage and the media pipeline work together?
The pipeline writes masters and derivatives into durable object storage. Separately, developer storage zones hold app/media adjunct files and can be fronted by CDN and image transforms. Both should sit behind the same control plane identity and quota model.

### 8) When should I choose a unified open stack over best-of-breed tools?
Choose unified when the integration tax of encoder + bucket + CDN + token service + webhook system exceeds the benefit of swapping components. Unified wins when your team wants one OpenAPI surface for policy, purge, playback, and automation.

---

## 22. References

- Ollanode platform
- Ollanode docs
- Videos & ingest docs
- Processing & AI docs
- Playback docs
- Storage & images docs
- CDN docs
- Webhooks docs
- How to Generate Dynamic HLS Resolution Ladders
- Apple HLS [OllaNode documentation](https://ollanode.com/docs) / HTTP Live Streaming overview
- CMAF / ISO BMFF packaging references for fMP4 segment design

---

## 23. Conclusion

Open source video infrastructure is not a romantic alternative to SaaS. It is an engineering response to a concrete problem: video became core product surface, and core product surface needs ownership of cost, policy, and failure modes.

The workable model is four layers with one contract:

- a control plane that turns product intent into safe API operations
- a pipeline that asynchronously produces honest adaptive HLS packages
- storage that keeps media and app assets durable under quotas
- a CDN/edge path that delivers quickly without exposing private origins

If any layer is missing, you do not have infrastructure — you have a project that will demand staff time at the worst possible moment.

Ollanode is one concrete implementation of that model: Apache-2.0 oriented, VOD-only, HLS-first, API-first, with signed playback, S3-style storage, pull-zone CDN, and a control plane strong enough for humans and governed agents. Use this article as the map. Use the ladder guide when you tune renditions. Use your own catalog measurements when you decide which rungs and regions deserve money.

Own the seams between the layers, and video stops being a surprise vendor relationship. It becomes backend capability — which is what it should have been from the start.

---
