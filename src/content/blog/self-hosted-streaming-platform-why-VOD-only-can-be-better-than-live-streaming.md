---
title: 'Self-Hosted Streaming Platform: Why VOD-Only Can Be Better Than Live Streaming'
seoTitle: 'Self-Hosted Streaming Platform: Why VOD-Only Beats Live in 2026'
description: 'Why a VOD-only self-hosted streaming platform can outperform a live-capable one — architecture, cost, reliability, and when live is actually worth the complexity.'
category: 'Video & CDN'
pubDate: 2026-09-04T09:00:00.000Z
author: 'The OllaNode Team'
tags: ['Video & CDN', 'VOD', 'HLS', 'Self-Hosted', 'Live Streaming', 'CDN', 'Storage', 'Architecture', 'Video Infrastructure', 'Apache-2.0']
---

Most streaming conversations start from a false assumption: that live is the advanced version of video, and VOD is the simplified fallback. "We'll start with on-demand, then add live later." It sounds like a roadmap. In practice, it is often a trap.

This guide argues the opposite case, deliberately and with evidence: for a large and growing class of products, a VOD-only self-hosted streaming platform is not a limitation — it is a strategic advantage. Live streaming is not a superset of VOD. It is a different architecture with a different cost model, a different failure surface, and a different operational burden. Choosing VOD-only is a real decision, not a compromise.

We use Ollanode as the concrete reference throughout: an Apache-2.0, self-hosted, API-first platform that is deliberately VOD-only — adaptive HLS, signed playback, S3-compatible storage, pull-zone CDN, edge functions — with no RTMP ingest and no live pipeline. That boundary is the point of this article, not an accident of the product.

This is an engineering argument, not a marketing pitch. By the end you will know what a VOD-only platform actually is, why live adds complexity that most products never need, when live genuinely is the right call, and how to decide for your own workload.

---

## Quick Answer: Why Would You Choose a VOD-Only Streaming Platform?

### At a Glance

| Question | Answer |
| :--- | :--- |
| **What does "VOD-only" mean?** | The platform ingests, processes, and delivers pre-recorded files as adaptive HLS. There is no RTMP ingest, no live encoder, no real-time manifest. |
| **Why is VOD-only better?** | It removes the live ingest path, the low-latency requirement, and the always-on encoder — the three most failure-prone and cost-heavy parts of a streaming stack. |
| **When does VOD-only win?** | When content is pre-recorded, when viewers watch on their own schedule, when reliability matters more than seconds of latency, and when you want a simpler, cheaper, more inspectable system. |
| **When is live actually required?** | Real-time events, auctions, live sports, interactive sessions, and anything where the value is in the moment itself. |
| **Is VOD-only cheaper?** | Yes, in most cases. No always-on ingest, no live transcoding capacity, no low-latency CDN requirements, and no 24/7 encoder fleet. |
| **Is VOD-only more reliable?** | Yes, structurally. A VOD pipeline is asynchronous and retryable; a live pipeline is real-time and cannot be re-run. |
| **Does VOD-only limit growth?** | Not for most products. The majority of "live" use cases are actually near-live or scheduled VOD — and VOD-only handles those better. |

The short version: VOD-only is the right default for most self-hosted streaming products. Live is a specialized addition you should be able to justify with a concrete requirement, not a checkbox on a roadmap. Everything below is the evidence and the framework for making that call.

<div class="key-takeaways-box" id="key-takeaways">
  <div class="key-takeaways-header">
    <span class="key-takeaways-icon">✦</span>
    <h3 class="key-takeaways-title">KEY TAKEAWAYS</h3>
  </div>
  <ul class="key-takeaways-list">
    <li><strong>Live is not a superset of VOD.</strong> It is a different architecture with a different ingest path, a different latency requirement, and a different failure model. Adding live is not "one more feature" — it is a second platform.</li>
    <li><strong>The three live-only costs are ingest, latency, and always-on capacity.</strong> RTMP ingest, low-latency delivery, and a 24/7 encoder fleet are the parts that make live expensive and fragile. VOD-only removes all three.</li>
    <li><strong>VOD is asynchronous and retryable; live is real-time and cannot be re-run.</strong> This single difference drives reliability, cost, and operational burden more than any other factor.</li>
    <li><strong>Most "live" products are actually scheduled VOD.</strong> Webinars, product launches, and "live" Q&As are pre-recorded or near-live. A VOD-only platform handles these better and cheaper.</li>
    <li><strong>Latency is a spectrum, not a binary.</strong> True live needs sub-second latency; most products need "good enough" — and VOD-only delivers that with far less complexity.</li>
    <li><strong>VOD-only is more inspectable and more secure.</strong> No open ingest port, no real-time encoder surface, and a fully retryable pipeline you can observe and re-run.</li>
    <li><strong>Ollanode is deliberately VOD-only:</strong> Rust/Axum control plane, async workers, source-aware HLS 360p–4K with no upscaling, SeaweedFS/S3 storage, OpenResty pull zones, and agent-aware governance — under Apache-2.0, with no RTMP and no live pipeline.</li>
  </ul>
</div>

---

## The Problem: Live Is the Default Assumption, and It Is Costing You

Here is a scenario most engineers have lived. A product team is scoping a video feature. Someone asks, "Do we need live streaming?" The answer is usually "maybe someday," and the platform is chosen accordingly — a live-capable vendor, or a self-hosted stack with RTMP ingest bolted on. The team spends weeks on ingest, latency tuning, and encoder configuration for a feature nobody has actually specified.

The problem is that "maybe someday" is not a requirement. It is a fear of being caught without a capability. And in video infrastructure, that fear is expensive. Live is not a small addition to a VOD platform. It changes the ingest path, the delivery model, the latency budget, the failure semantics, and the operational burden. You are not adding a feature; you are running a second platform.

The cost shows up in four places:

1. **Ingest.** Live needs an always-open ingest endpoint (RTMP or SRT) that accepts a real-time encoder stream. That is a permanently exposed network surface, a connection you must keep alive, and a protocol you must secure.
2. **Latency.** Live viewers expect near-real-time. That forces low-latency HLS or WebRTC, which changes how segments are packaged, cached, and delivered. Low-latency delivery is harder to cache and more expensive to serve.
3. **Always-on capacity.** A live event needs transcoding capacity available the moment the stream starts. You cannot queue a live job and retry it later. You must provision for the peak, whether or not anyone watches.
4. **Failure semantics.** A VOD job that fails can be re-run. A live stream that fails is gone. The moment is lost. That single difference drives the entire operational model.

None of these are problems for a VOD-only platform, because none of them exist. The question this article answers is whether that absence is a weakness or a strength. For most products, it is a strength.

---

## A Short History: How Live Became the "Advanced" Option

The idea that live is the "advanced" version of video is a historical accident, not a technical truth.

In the broadcast era, live was the only option. Television was a real-time signal; there was no storage and no replay. "Video" and "live" were nearly synonymous. When the internet arrived, the first streaming experiments were live too — because the technology for storing and serving files at scale did not exist yet. Live was the default because it was the only thing possible.

VOD is the newer, harder-won capability. It required cheap storage, efficient encoding, adaptive bitrate delivery, and a CDN that could serve the same file to millions of viewers on demand. Every one of those was a hard engineering problem. VOD is not the simplified version of live; it is the product of decades of infrastructure that live never needed.

The confusion persists because of how the market labels things. "Live streaming platform" sounds like the premium tier. But the premium tier is the one that serves a pre-recorded catalog to viewers on their own schedule, reliably, at scale, without a single point of failure in a real-time encoder. That is VOD.

The practical consequence: teams over-invest in live capability they do not need, and under-value the VOD-only platform that would serve their actual product better. This article is the correction.

---

## Definition: What a VOD-Only Streaming Platform Actually Is

A VOD-only streaming platform is a system that ingests pre-recorded media files, processes them asynchronously into adaptive streaming renditions, and delivers them to viewers on demand. There is no real-time ingest, no live encoder, and no requirement that a viewer watch at the moment of upload.

The defining characteristics:

- **File-based ingest.** Content arrives as a complete file (MP4, MOV, MKV) via upload, presigned PUT, multipart, or pull-from-URL. There is no RTMP or SRT ingest endpoint.
- **Asynchronous processing.** Upload and playback are decoupled. A file is validated, transcoded, packaged, and stored as a background job. The viewer never waits on the pipeline.
- **Adaptive delivery.** Content is packaged into HLS with multiple renditions, so each viewer gets the quality their connection supports.
- **On-demand playback.** Viewers watch when they choose. There is no "live" moment to miss.

In Ollanode terms, a VOD-only platform is the full pipeline: upload → validate → metadata → transcode → HLS → thumbnails → transcript → storage → webhook → ready, delivered through a pull-zone CDN with signed playback.

The contrast is a live-capable platform, which adds a real-time ingest path, a low-latency delivery mode, and always-on transcoding capacity. Those additions are not free, and they are not optional extras — they are a second architecture running alongside the first.

---

## Architecture: The VOD-Only Stack

A VOD-only platform has four coupled systems, and none of them are real-time:

- **Control plane** — accepts intent: API keys, scopes, project tenancy, asset records, playback policy, job dispatch, webhooks, audit.
- **Pipeline** — turns bytes into adaptive streams: validate → extract metadata → transcode → package HLS → thumbnails/transcripts → store → webhook → mark ready.
- **Storage** — durable originals and derivatives, typically S3-compatible.
- **CDN/edge** — absorbs playback traffic without leaking private origins, with pull zones, purge, and signed delivery.

The architectural point that matters: every stage is asynchronous and retryable. A job is published to a queue, picked up by a worker, and can be re-run if it fails. There is no real-time dependency anywhere in the path.

In Ollanode terms, that is a Rust/Axum control plane backed by PostgreSQL and NATS JetStream (with optional Temporal for durable workflows), async worker pools for processing, SeaweedFS/S3-compatible storage, and OpenResty pull zones for delivery.

Now compare that to what live adds:

- **An ingest layer** — an always-open RTMP/SRT endpoint that accepts a real-time encoder stream.
- **A low-latency delivery path** — segment packaging tuned for near-real-time, which is harder to cache.
- **Always-on transcoding** — capacity that must be available the instant a stream starts.

The VOD-only architecture is smaller, simpler, and every part of it is inspectable and retryable. That is not a limitation; it is the reason it is more reliable.

---

## Internal Working: Why VOD Is Asynchronous and Live Is Not

The deepest difference between VOD and live is not latency or cost. It is failure semantics.

A VOD job is asynchronous. You upload a file, the API publishes a job to the message stream, and a worker processes it. If the worker fails, the job is retried. If the transcode produces a bad rendition, you re-run that stage. The pipeline is designed around the assumption that things fail, and it recovers.

A live stream is real-time. The encoder is pushing frames now, and the viewer is watching now. If the ingest drops, the transcode lags, or the CDN stalls, the moment is lost. You cannot re-run a live event. The entire system is designed around the assumption that it must not fail, which is why it is so much harder to build and operate.

This is the single most important mental model in this article:

> **VOD is a retryable batch job. Live is a real-time process that cannot be re-run.**

Everything else — cost, reliability, operational burden, security — follows from that distinction. A VOD-only platform gets to be a batch system, with all the benefits that come with it: retries, backpressure, queue depth visibility, and the ability to re-run a failing stage without reprocessing the whole asset.

---

## Components: What You Run (and What You Don't)

A VOD-only platform runs a specific, finite set of components. Listing them makes the contrast with live concrete.

### What a VOD-only platform runs:

- **API service** — the entry point for uploads, asset queries, project management, and webhook configuration.
- **Job orchestrator** — publishes jobs to the message stream and coordinates workers.
- **Transcoding workers** — do the actual encoding (FFmpeg under the hood), coordinated by the platform's Rust code.
- **Storage layer** — holds source files, renditions, thumbnails, and transcripts.
- **Delivery layer** — CDN pull-zone configuration, signed URL generation, and cache behavior.
- **Database and message stream** — PostgreSQL for metadata, NATS JetStream for jobs.

### What a live-capable platform adds:

- **RTMP/SRT ingest server** — an always-open endpoint for real-time encoder streams.
- **Live transcoding workers** — capacity that must be available the instant a stream starts.
- **Low-latency packaging** — segment generation tuned for near-real-time delivery.
- **Live monitoring** — real-time health checks on active streams, because a live failure is unrecoverable.

The VOD-only list is finite and predictable. The live additions are a second platform with a different operational model. If you do not need live, you are not "missing" components — you are avoiding a second system you would have to run, secure, and keep alive.

---

## Workflow: The VOD-Only Asset Lifecycle

The asset lifecycle in a VOD-only platform is clean and fully observable:

`created` → `upload_pending` → `uploaded` → `processing` → `ready` | `errored`

The default pipeline flow in Ollanode is:

**Upload → Validate → Metadata → Transcode → HLS → Thumbnails → Transcript → Storage → Webhook → Ready**

Step by step:

1. **Upload.** A file arrives via API, presigned PUT, multipart, or pull-from-URL.
2. **Validate.** The platform checks container format, codec, and duration before accepting the file.
3. **Extract metadata.** Duration, resolution, bitrate, and audio characteristics are recorded.
4. **Transcode.** The file is encoded into the configured resolution ladder.
5. **Package HLS.** Renditions are packaged into adaptive HLS with CMAF/fMP4 segments.
6. **Generate thumbnails and transcripts.** Optional, as part of the same pipeline run.
7. **Store.** Outputs land in S3-compatible storage.
8. **Webhook.** A signed payload notifies your application that the asset is ready.
9. **Deliver.** Viewers stream through the pull-zone CDN with signed playback.

Every step is asynchronous, observable, and retryable. If a transcode fails, you see the job state, the queue depth, and the error — and you re-run the failing stage. There is no real-time dependency anywhere.

A live workflow, by contrast, is a continuous process: encoder → ingest → transcode → package → deliver, all in real time, with no retry and no re-run. The VOD-only workflow is the one you can actually operate.

---

## Configuration: Tuning a VOD-Only Pipeline

Because a VOD-only pipeline is asynchronous, its configuration is declarative and versionable. You configure the ladder, the codec tier, the storage backend, and the playback policy — and the pipeline applies them to every asset.

A project-level ladder configuration in Ollanode:

```bash
ollanode projects configure my-project \
  --renditions "4K:16000k,1080p:4500k,720p:2500k,480p:1200k,360p:600k" \
  --codec h264 \
  --no-upscale true
```

You can scope ladders per project or per asset, enable H.265/NVENC or SVT-AV1 as config-gated tiers, and verify the resulting manifest carries accurate BANDWIDTH and RESOLUTION values.

A production-oriented environment configuration:

```bash
STORAGE_BACKEND=s3
S3_BUCKET=your-video-bucket
S3_REGION=us-east-1
CDN_BASE_URL=https://cdn.yourapp.com
WEBHOOK_SIGNING_SECRET=replace-with-a-random-32-byte-value
```

The key point: VOD-only configuration is deterministic. You set it once, and every asset follows the same rules. Live configuration, by contrast, is per-event and real-time — you are tuning an encoder and a latency budget while the stream is running. That is a fundamentally harder thing to configure and to get right.

---

## Examples: When VOD-Only Wins

The clearest way to see the argument is through concrete scenarios. These are the products where VOD-only is not just acceptable — it is the better choice.

1. **A course or training platform.** Content is pre-recorded lectures. Viewers watch on their own schedule, pause, rewind, and re-watch. There is no "live moment." A VOD-only platform serves this perfectly, with none of the live complexity. The "live" version of this — a scheduled webinar — is usually pre-recorded anyway.
2. **A product documentation and demo library.** Screencasts, walkthroughs, and release demos are recorded once and watched many times. VOD-only is the obvious fit. The "live" launch event is a scheduled VOD that goes out on a timer.
3. **An internal training or compliance library.** Content is recorded, reviewed, and distributed to employees. It must be secure, signed, and auditable. VOD-only gives you signed playback and a fully inspectable pipeline — without an open ingest port.
4. **A media or entertainment catalog.** Movies, shows, and clips are pre-produced. Viewers browse and watch on demand. This is the canonical VOD use case, and it is where adaptive HLS and CDN delivery shine.
5. **A "near-live" product launch.** The team wants the energy of "live" without the risk. They pre-record the presentation, schedule it, and let viewers watch it as it "airs." A VOD-only platform handles this with scheduled playback — and if the recording has a flaw, they fix it and re-upload, which live would never allow.

In each of these, the VOD-only platform is cheaper, more reliable, and easier to operate than a live-capable one — because the product does not actually need real-time delivery.

---

## Performance: Latency, Throughput, and the Live Trade-Off

Performance means different things in VOD and live, and conflating them causes bad decisions.

**VOD performance is about throughput and quality.** How fast can you process a batch of uploads? How many renditions can you generate per hour? How high is your CDN cache hit ratio? These are all tunable, observable, and retryable. You can scale transcoding workers horizontally behind the job queue, tune the ladder to reduce encode time, and lean on CDN caching to keep origin bandwidth low.

**Live performance is about latency and uptime.** How close to real-time is the stream? How long can the encoder stay connected without dropping? These are real-time constraints with no retry. Low-latency delivery is harder to cache and more expensive to serve, and a live failure is unrecoverable.

The trade-off is a spectrum, not a binary. True live needs sub-second latency. Most products need "good enough" — a few seconds of delay is invisible to a viewer watching a scheduled presentation. VOD-only delivers "good enough" latency with far less complexity, because the content is pre-recorded and the delivery is asynchronous.

The honest framing: if your product can tolerate a few seconds of delay, VOD-only gives you the reliability and cost profile of a batch system with the viewing experience of a live event. That is a trade most products should take.

---

## Security: The Smaller Attack Surface of VOD-Only

Security is where VOD-only has a structural, not incidental, advantage.

A live-capable platform has an always-open ingest port — an RTMP or SRT endpoint that accepts real-time encoder streams. That is a permanently exposed network surface that must be authenticated, rate-limited, and monitored. It is a standing invitation to anyone who wants to probe your infrastructure.

A VOD-only platform has no ingest port. Content arrives as files through authenticated API calls, presigned URLs, or pull-from-URL. There is no real-time endpoint to attack. The attack surface is smaller by construction.

The rest of the security model is the same primitives a good platform provides, but on infrastructure you control:

- **Signed, expiring playback tokens** — for anything that is not fully public.
- **Private S3-compatible storage** — originals and derivatives never exposed directly.
- **A gated playback origin** — viewers reach content only through the CDN, never the origin.
- **Webhook signature verification** — so your application only trusts authenticated processing events.
- **Per-tenant isolation and audit logging** — for multi-tenant deployments.

The security argument is not that VOD-only is "more secure" in the abstract. It is that VOD-only removes an entire class of attack surface — the real-time ingest path — that live necessarily adds. Fewer moving parts, fewer exposed endpoints, fewer ways in.

---

## Troubleshooting: The VOD-Only Failure Modes

Because a VOD-only pipeline is asynchronous and retryable, its failure modes are diagnosable and recoverable. Here is the reference for the ones that actually show up.

- **Uploads succeed but processing never starts.** Check that the job orchestrator is connected to the message stream and that at least one worker is healthy. A queue that accepts jobs but never drains them is an orchestration problem, not a transcoding problem.
- **Assets fail validation immediately.** Confirm the source file's container and codec are supported. Re-mux locally with FFmpeg to rule out a nonstandard container.
- **Playback URL returns a 403.** Almost always signed-URL misconfiguration — either the signing secret used to generate the URL does not match the one the delivery service verifies against, or the token has expired.
- **Webhook events never arrive.** Verify your endpoint is publicly reachable, check for a firewall blocking outbound requests, and confirm the webhook URL was saved correctly.
- **Renditions are missing from the manifest.** Check worker logs for that asset ID — a partial rendition failure often still produces a manifest, just with fewer variants than expected.
- **Player loads the manifest but never plays.** Check that CORS is configured on the CDN if the player runs on a different domain.

The defining feature of all of these: every failure is visible, logged, and re-runnable. You see the job state, the queue depth, and the error. You re-run the failing stage. A live failure, by contrast, is a lost moment — there is nothing to re-run. That is the operational difference that makes VOD-only genuinely easier to run.

---

## Best Practices for a VOD-Only Platform

These are the practices that separate a working VOD-only deployment from one that is fragile.

### 1. Move off local disk early.
Local storage doesn't survive container rebuilds and has no redundancy — a routine deploy can wipe your whole catalog. Use S3-compatible object storage (S3, R2, MinIO, B2) before handling any real traffic. It's just a few environment variables, and the backend is swappable without touching pipeline logic. The cost of moving late is a data-loss incident; the cost of moving early is a config change.

### 2. Tune the ladder to your content, not a default.
A default ladder is tuned for an average catalog that probably isn't yours, wasting encode time and storage on renditions nobody watches. Talking-head content doesn't need a 4K ladder; high-motion content may need more at the top. Configure per project or per asset, and use `--no-upscale true` so you never generate renditions above the source resolution. Every rendition you skip saves money on every single asset, forever.

### 3. Use signed playback for anything non-public.
An unsigned playback URL is a permanent key to the content — a single leak becomes a permanent backdoor. Signed, expiring tokens give per-viewer, time-limited access control. Set a sensible token TTL (a few hours is a good default), tightened for higher-sensitivity material. Keep the signing secret separate from other secrets so a leak in one system doesn't compromise the other.

### 4. Verify webhook signatures.
Trusting unsigned payloads opens your app to spoofed events, including a fake "ready" state that publishes broken content. Read the raw request body before parsing it as JSON, since verification needs the raw bytes. Recompute the signature with your webhook secret and reject mismatches before processing anything. Use a separate signing secret for webhooks than for playback URLs.

### 5. Scale workers horizontally, not vertically.
Video processing is a queue-based batch workload, so the bottleneck is throughput, not the size of any single worker. Add more transcoding workers behind the queue as upload volume grows, rather than making one worker larger. Because jobs are distributed through the message stream, new workers pick up load automatically. A queue that grows faster than it drains is a worker-capacity problem, not a transcoding one.

### 6. Lean on CDN caching.
Most delivery traffic should never reach origin storage once caching is tuned — the CDN absorbs playback, the origin serves only cache misses. Set long TTLs for immutable segment files and shorter TTLs for manifests that may be regenerated. A low cache hit ratio usually means TTLs are too short or cache keys include something that should be ignored. Origin bandwidth climbing with viewer traffic is a caching misconfiguration, not a capacity problem.

### 7. Test failure paths deliberately.
A production pipeline is defined by what it does when a stage fails, not by the happy path. Deliberately upload an invalid file, send an invalid webhook signature, and try an expired playback URL. Confirm each fails cleanly — a bad file is rejected, a bad signature is refused, an expired URL returns a 403. Learn that behavior before you ship, not after, with real users watching.

---

## Common Mistakes to Avoid

- **Adding live "for someday."** If you cannot name the concrete requirement that needs real-time delivery, you do not need live. "Maybe someday" is a fear, not a requirement — and it costs you a second platform to run.
- **Confusing "live" with "scheduled."** A webinar that airs at a set time is not live if the content is pre-recorded. It is scheduled VOD. A VOD-only platform handles it better, and you can fix a flawed recording before it airs.
- **Underestimating the live ingest surface.** An always-open RTMP/SRT endpoint is a permanently exposed network surface. If you do not need it, you are carrying an attack surface for no reason.
- **Assuming VOD is the "simplified" version.** VOD is the product of decades of infrastructure — cheap storage, efficient encoding, adaptive delivery, CDN scale. It is not the fallback; it is the mature capability.
- **Provisioning for live peaks you will never hit.** Live requires always-on transcoding capacity. VOD-only lets you scale workers to your actual batch workload, not a hypothetical live peak.
- **Ignoring the failure semantics.** A VOD job that fails can be re-run. A live stream that fails is gone. If your product cannot tolerate a lost moment, you need live — and you should be honest about that cost.
- **Choosing a "platform" that is really DIY glue.** A real VOD-only platform has tenancy, auth, job status, webhooks, playback tokens, and purge. Scripts have none of that. If you self-host, use something with the same primitives a good SaaS provides.

---

## Alternatives: When Live Is Genuinely Required

VOD-only is the right default, but it is not the right answer for everything. Be honest about when live is genuinely required.

### Live is required when the value is in the moment itself:

- **Live sports and events** — the result is unknown until it happens; the value is real-time.
- **Auctions and real-time bidding** — the transaction is time-sensitive.
- **Interactive sessions** — live Q&As, workshops, and consultations where the audience participates in real time.
- **Emergency and operational broadcasts** — where the information is time-critical.

### Live is a reasonable addition when:

- You have a genuine, specified requirement for real-time delivery.
- You have the operational capacity to run a second platform.
- The revenue or value of the live moment justifies the cost and complexity.

The hybrid reality: many products run VOD-only for their catalog and add a live capability only for specific events. That is legitimate — but it should be a deliberate, justified addition, not a default assumption. If you are evaluating the VOD-only side, run a real catalog through a self-hosted platform before you commit. That evidence will tell you more than any comparison table.

---

## Comparison Tables: VOD-Only vs. Live-Capable

### Architecture and Operations

| Dimension | VOD-Only | Live-Capable |
| :--- | :--- | :--- |
| **Ingest** | File-based (upload, presigned, pull-from-URL) | Real-time (RTMP/SRT encoder stream) |
| **Processing** | Asynchronous, retryable batch jobs | Real-time, cannot be re-run |
| **Latency** | "Good enough" (seconds) | Sub-second (if truly live) |
| **Transcoding capacity** | Scales to batch workload | Must be available at stream start |
| **Failure handling** | Re-run the failing stage | The moment is lost |
| **Attack surface** | No ingest port | Always-open ingest endpoint |
| **Operational model** | Batch system, observable and retryable | Real-time process, always-on |

### Cost and Reliability

| Dimension | VOD-Only | Live-Capable |
| :--- | :--- | :--- |
| **Ingest infrastructure** | None | Always-on ingest server |
| **Transcoding** | Scales to workload | Provisioned for live peak |
| **Delivery** | Standard CDN caching | Low-latency, harder to cache |
| **Reliability** | High (retryable) | Lower (unrecoverable failures) |
| **Operational burden** | Lower | Higher (second platform) |
| **Best fit** | Pre-recorded, on-demand, scheduled | Real-time events, auctions, live sports |

---

## Enterprise Deployment: VOD-Only at Scale

At enterprise scale, the VOD-only advantages compound. A large catalog, a distributed team, and strict compliance requirements all favor a platform that is asynchronous, inspectable, and retryable.

- **Storage tiering.** As the catalog grows, revisit storage tiering. Frequently watched content stays on faster, pricier storage; long-tail content moves to cheaper cold storage. Introduce lifecycle rules that automate the transition.
- **Worker scaling.** As upload volume grows, add more transcoding workers behind the queue. Because jobs are distributed through the message stream, additional workers pick up load automatically. This is the point where GPU-accelerated transcoding becomes worth evaluating.
- **Observability.** Wire up centralized logging and monitoring for the API, workers, and queue. Track queue depth, worker health, API error rates, storage growth, CDN cache hit ratio, and webhook delivery success. A minimum viable setup is centralized logging plus basic dashboards; a mature setup adds alerting.
- **Security hardening.** Rotate every API key and signing secret generated during testing. Confirm webhook signature verification actually rejects unsigned requests. Enable signed playback URLs for anything non-public. Restrict database and storage credentials to minimum permissions. Put the API behind a reverse proxy that enforces TLS. Store secrets in a secrets manager.
- **Multi-tenant isolation.** A real platform provides project tenancy, scoped API keys, and per-tenant playback policy. This is essential once more than one application or team shares the same pipeline.

The enterprise point: a VOD-only platform is a batch system you can operate with confidence. Every layer is observable, every failure is re-runnable, and there is no real-time dependency to babysit.

---

## Cloud Deployment: VOD-Only on Managed Infrastructure

VOD-only deploys cleanly on managed infrastructure, because it is a standard queue-based batch system.

- **On a single VM or container host.** Docker Compose brings up the control plane, database, message stream, and workers. Local disk is fine for testing; S3-compatible storage is required for anything real.
- **On Kubernetes.** The same architecture maps to manifests or a Helm chart. The advantage of Kubernetes is finer-grained autoscaling of workers based on queue depth, rather than manual capacity planning.
- **Storage.** Point the platform at S3-compatible object storage — AWS S3, Cloudflare R2, MinIO, Backblaze B2 — and swap backends without touching pipeline logic.
- **Delivery.** Configure a CDN pull zone with TTLs, CORS rules, edge rules, and hotlink token signing. Long TTLs for immutable segment files; shorter TTLs for manifests if renditions may be regenerated.

The cloud point: VOD-only is boring in the best way. It is a predictable, queue-based batch system that runs identically on a single VM or a Kubernetes cluster. There is no real-time ingest to keep alive and no low-latency delivery to babysit.

---

## Frequently Asked Questions

### Q1. Why would I choose a VOD-only platform over a live-capable one?
Because for most products, live is a second platform you do not need. VOD-only removes the real-time ingest path, the low-latency requirement, and the always-on encoder — the three most failure-prone and cost-heavy parts of a streaming stack. If your content is pre-recorded and viewers watch on their own schedule, VOD-only is cheaper, more reliable, and easier to operate.

### Q2. Is VOD-only really cheaper than live?
Yes, in most cases. No always-on ingest server, no live transcoding capacity provisioned for a peak, no low-latency delivery that is harder to cache. A VOD-only platform scales workers to your actual batch workload and leans on standard CDN caching.

### Q3. Is VOD-only less capable than live?
No. VOD is not the simplified version of live; it is the mature capability. It required cheap storage, efficient encoding, adaptive delivery, and CDN scale. Live is the specialized addition, and it is only worth it when the value is in the moment itself.

### Q4. What is the difference between "live" and "scheduled VOD"?
A webinar that airs at a set time is not live if the content is pre-recorded — it is scheduled VOD. A VOD-only platform handles it better, and you can fix a flawed recording before it airs. True live is only required when the value is in the real-time moment.

### Q5. Does a VOD-only platform have a smaller attack surface?
Yes, structurally. A live-capable platform has an always-open RTMP/SRT ingest port. A VOD-only platform has no ingest port — content arrives as files through authenticated API calls. Fewer exposed endpoints, fewer ways in.

### Q6. Can I add live later if I start VOD-only?
Yes, and that is the right way to approach it. Start VOD-only for your catalog, and add live only when you have a concrete, specified requirement. Choose a platform with a clean API so the addition is deliberate, not a retrofit.

### Q7. What should I look for in a VOD-only self-hosted platform?
A real control plane with tenancy and auth, async processing with job status, signed playback tokens, S3-compatible storage, integrated CDN with purge, webhooks, and a permissive license (Apache-2.0) if you ship commercially. Avoid platforms that are really DIY glue.

### Q8. Is Ollanode VOD-only, and why?
Yes. Ollanode is deliberately VOD-only — adaptive HLS, signed playback, S3-compatible storage, pull-zone CDN, edge functions — with no RTMP ingest and no live pipeline. That boundary is a design decision: it removes the live complexity most products never need, and it is released under Apache-2.0 so you can inspect and modify the pipeline.

---

## References

- OllaNode Docs — platform documentation
- Setting Up Your [first open-source video pipeline with OllaNode](/blog/setting-up-first-open-source-video-pipeline-ollanode) — the VOD pipeline walkthrough
- [dynamic HLS resolution ladders](/blog/how-to-generate-dynamic-hls-resolution-ladders) Resolution Ladders — ladder configuration
- Self-Hosted Video Platform [self-hosted video platform vs SaaS](/blog/self-hosted-video-platform-vs-saas-cost-control-security-and-stability) — architecture and deployment guide

---

## Conclusion: The VOD-Only Decision

The most useful mental model to carry forward: live is not a superset of VOD. It is a different architecture with a different cost model, a different failure surface, and a different operational burden. Choosing VOD-only is a real decision, not a compromise.

For most self-hosted streaming products, VOD-only is the better choice. It is cheaper — no always-on ingest, no live transcoding capacity, no low-latency delivery. It is more reliable — every stage is asynchronous and retryable, and a failed job can be re-run. It is more secure — no open ingest port, a smaller attack surface by construction. And it is easier to operate — a predictable batch system you can observe, scale, and re-run.

Live is genuinely required only when the value is in the moment itself: live sports, auctions, interactive sessions, emergency broadcasts. If your product does not have that requirement, you are not missing a capability — you are avoiding a second platform you would have to run.

The decision is not permanent. Start VOD-only for your catalog, and add live only when you have a concrete, specified requirement. Run a real catalog through a self-hosted VOD-only platform before you commit. Watch how the queue, storage, and delivery layers behave under your actual workload, tune the ladder and codec to your content, and confirm the security surface matches your threat model. That evidence will tell you more than any comparison table.

Explore the full platform and documentation at OllaNode Docs or view OllaNode Features Overview.

---
