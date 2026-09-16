---
title: 'Introducing OllaNode: Self-Hosted Video Infrastructure for Developers'
seoTitle: 'OllaNode: Self-Hosted Video Infrastructure for Developers'
excerpt: 'Discover OllaNode, an Apache-2.0 self-hosted video infrastructure platform with VOD, HLS, CDN, storage, DNS, edge functions, and AI-agent governance.'
description: 'Discover OllaNode, an Apache-2.0 self-hosted video infrastructure platform with VOD, HLS, CDN, storage, DNS, edge functions, and AI-agent governance.'
category: 'Product & Changelog'
publishedDate: 'August 21, 2026'
pubDate: 2026-08-21
readingTime: '27 min read'
author:
  name: 'The OllaNode Team'
  role: 'Core Team'
  avatar: '⚡'
tags: ['Product & Changelog', 'Self-Hosted', 'Video Infrastructure', 'VOD', 'HLS', 'CDN', 'Storage', 'DNS', 'Edge Functions', 'AI Agents', 'Apache-2.0', 'Rust']
featured: true
---

Building a video platform usually starts with a simple requirement: upload a video and let users watch it. But as traffic and content grow, the infrastructure behind that feature becomes much more complex. Video platforms need transcoding pipelines, adaptive bitrate streaming, storage, CDN delivery, signed playback URLs, thumbnails, and reliable background processing.

Self-hosted video infrastructure gives developers control over those systems instead of relying entirely on a managed video provider. The trade-off is that your team becomes responsible for operating the underlying infrastructure.

OllaNode is a self-hosted video infrastructure platform for developers who want to run and control their own video stack. It combines video processing, VOD, HLS delivery, CDN, storage, DNS, edge functions, APIs, and AI-agent governance under one control plane.

Built as an API-first platform and released under the Apache-2.0 license, OllaNode is designed for teams that want greater control over their video infrastructure, deployment model, and data.

## What Is Self-Hosted Video Infrastructure?

Self-hosted video infrastructure means running the systems that process, store, secure, and deliver video on infrastructure you control instead of relying entirely on a managed video provider. Depending on the workload, that can include video ingestion, transcoding, adaptive bitrate packaging, object storage, CDN delivery, playback security, APIs, DNS, and background job orchestration.

Self-hosting is not automatically the right choice for every team. It becomes especially relevant when data ownership, deployment control, customization, predictable infrastructure costs, or compliance requirements matter enough to justify operating the underlying stack. OllaNode is designed for that audience: developers and teams who want the convenience of a unified video platform without giving up control of the infrastructure underneath it.

> **Quick answer: What is OllaNode?**
> OllaNode is a self-hosted video infrastructure platform for developers. It combines VOD processing, HLS delivery, CDN, storage, DNS, edge functions, webhooks, security, and AI-agent governance under one API-first control plane that you can run and modify on your own infrastructure.

<div class="key-takeaways-box" id="key-takeaways">
  <div class="key-takeaways-header">
    <span class="key-takeaways-icon">✦</span>
    <h3 class="key-takeaways-title">KEY TAKEAWAYS</h3>
  </div>
  <ul class="key-takeaways-list">
    <li><strong>OllaNode</strong> is a self-hosted video infrastructure platform built for developers who want control over their video stack.</li>
    <li>It combines VOD processing, HLS delivery, CDN, storage, DNS, and edge functions in one self-hosted platform.</li>
    <li>The VOD pipeline is asynchronous and event-driven, covering transcoding, HLS generation, thumbnails, transcripts, storage, and webhooks.</li>
    <li><strong>Apache-2.0 licensing</strong> allows teams to inspect, modify, fork, and commercially deploy OllaNode.</li>
    <li><strong>AI-agent workflows</strong> include security guardrails, such as scoped capabilities, approval gates, audit logging, and human-only actions.</li>
  </ul>
</div>

## The Problem With Renting Your Video Infrastructure

Managed video platforms exist because video infrastructure is genuinely difficult to operate. Encoding is CPU- and GPU-intensive, adaptive bitrate streaming requires a reliable processing pipeline, and serving video at scale requires CDN caching, storage, security, and observability. Building and operating all of these components internally can require significant engineering effort.

But "accessible" and "yours" are different things. A few realities tend to surface once a product with vendor-hosted video actually grows:

1. **The billing model punishes success.** Per-minute storage plus per-minute delivery sounds simple until your catalog and your audience both grow at once. The bill doesn't scale with your revenue — it scales with your usage, and those two curves rarely move together in the early years of a product.
2. **Your data lives in someone else's account.** Every video you've ever processed, every transcript, every thumbnail — it's sitting inside a third party's infrastructure, governed by their terms of service, their retention policy, and their outage schedule. Migrating away later means re-encoding your entire library, which is exactly the kind of project nobody schedules until they're forced to.
3. **You inherit their roadmap, not yours.** Need a custom cache rule at the edge? A different storage backend? A specific encryption policy for HLS segments? You file a ticket and wait, because the platform's priorities are not your priorities.
4. **Compliance gets complicated fast.** Regulated industries — healthcare, finance, government, education — often need to know exactly where video data sits, who can access it, and how it's encrypted, in terms precise enough to survive an audit. "It's in our vendor's cloud, in one of their regions" is rarely a satisfying answer.

None of this means managed platforms are wrong for every team. If you need to ship a video feature in an afternoon and infrastructure ownership isn't a priority, a vendor is often the right call. But if you're a platform team, an infrastructure-conscious startup, an agency serving clients with strict data requirements, or simply a developer who believes the software running your product should be software you can read — the honest alternative has, until now, been "build it yourself from FFmpeg and prayer."

OllaNode is what we wished existed when we were in that position.

---

## What Is OllaNode?

At its core, OllaNode is a self-hosted video infrastructure platform that combines video processing, delivery, storage, and supporting infrastructure under a control plane you operate yourself. It is designed as an alternative to fully managed video platforms for teams that want greater control over deployment, infrastructure, and customization.

It ingests a video, transcodes it to an adaptive HLS ladder from 360p up to 4K, extracts thumbnails and a storyboard sprite, generates word-level transcripts, and serves signed, expiring playback — all behind a single project-scoped REST API. There's no separate video service, separate CDN vendor, and separate storage bill to reconcile. It's twelve product surfaces — video, playback, thumbnails and transcripts, CDN, storage, DNS, edge functions, webhooks, accounts and access, an AI-agent governance model, security, and orchestration — unified under one control plane.

Here's what a video upload looks like in practice:

```bash
$ curl -X POST https://api.ollanode.com/v1/videos \
  -H "Authorization: Bearer $OLLA_KEY" \
  -d '{"title":"launch.mp4"}'

# 201 Created
{
  "id": "vid_8Kd2Qa7Rn0",
  "status": "created",
  "master_url": "…/hls/master.m3u8?token=…"
}
```

That's the entire mental model. You POST a video, the pipeline does the rest asynchronously, and you get back a signed master playlist URL you can hand to any HLS-compatible player — or to OllaNode's own embeddable Vidstack-based player, which we'll get to shortly.

If you're the kind of developer who reads architecture diagrams before marketing copy, here's the shape of the system: a REST client talks to an `api-gateway`, which publishes events onto NATS JetStream. Independent services — `upload`, `transcode`, `thumbnail`, `transcript`, `webhook`, `cdn-edge-agent`, `playback`, and `dns-service` — consume those events, do their piece of work, and write results to PostgreSQL and an S3-compatible object store. Nothing runs synchronously inside a request handler; long-running work — and video processing is always long-running work — happens in the background, where it belongs.

## Under the Hood: A Rust Workspace, Not a Monolith

Self-hosted software can take many forms, from wrappers around managed services to larger distributed systems. OllaNode takes the latter approach: the platform is structured as independently deployable services connected through defined infrastructure adapters.

The whole platform is a Cargo workspace built in Rust on Axum: 11 library crates and 9 independently-deployable services. That split matters more than it might sound. The domain core has no IO — no database calls, no HTTP clients, no filesystem access — and every adapter that talks to Postgres, S3, NATS, or FFmpeg implements a port defined by that core. This is clean architecture and domain-driven design applied literally, not just referenced in a README. The upshot for you as an operator: business logic doesn't leak into infrastructure code, infrastructure can be swapped without touching business logic, and the system is legible enough that a competent Rust engineer can actually trace a request from the gateway to the database and back.

The technology choices are deliberately boring in the best sense — proven, permissively licensed components rather than exotic dependencies:

- **Axum** for the HTTP layer, on top of Tokio's async runtime
- **PostgreSQL** as the system of record
- **NATS JetStream** as the default event and job backbone (with Temporal available as a drop-in alternative behind a `TEMPORAL_ENABLED=true` flag — both engines share the same activity implementation, so you're never locked into one orchestration model)
- **S3-compatible object storage**, commonly SeaweedFS for self-hosted deployments
- **FFmpeg** for transcoding, with H.264 as the default codec and optional H.265/NVENC for GPU-accelerated encodes
- **WhisperX** for word-level transcription and optional speaker diarization
- **imgproxy** for on-the-fly image resizing and format conversion
- **tusd** for resumable uploads
- **Coraza**, implementing the OWASP Core Rule Set, as a Web Application Firewall in front of the API
- **Hickory** as an authoritative DNS server
- **Supabase's Edge Runtime** to execute edge functions in V8 isolates
- **Vidstack** as the embeddable player

Every one of those is permissively licensed — more on why that specific detail was non-negotiable for us in a moment.

From a numbers standpoint, the platform breaks down into 9 services and 11 shared library crates, transcodes into an adaptive ladder spanning 360p to 4K, and — because AVIF is a genuinely better format than JPEG for web delivery — cuts poster image sizes by roughly 52% through the built-in image optimizer. The DNS service listens authoritatively on port 53, because if you're going to run your own CDN, you eventually want to run your own zones too.

## OllaNode's VOD Pipeline: One Upload, a Full Production Line

The heart of OllaNode is the VOD pipeline, and it's worth walking through in detail because it explains a lot about how the platform thinks about video processing.

Every video you upload triggers the same event-driven sequence:

`upload_completed` → `validate` → `extract_metadata` → `transcode` → `generate_hls` → `thumbnails` → `transcript` → `store_assets` → `emit_webhook` → `mark_ready`

Each arrow in that chain is a step consumed off NATS JetStream (or Temporal, if you've enabled it) by a dedicated worker — never inline, in a request/response cycle, the way a lot of "quick and dirty" video tooling handles it. That distinction matters enormously in practice. If you've ever built a video upload feature where the HTTP request hangs for ninety seconds while ffmpeg grinds away in the background, you already understand why async-by-default is the correct design, not an optimization.

Walking through what actually happens at each step:

1. **Validate.** The uploaded file is checked before any expensive work begins — is it actually a video, is the container readable, is it within acceptable limits. Failing fast here saves GPU and CPU cycles for the videos that are actually going to make it to encoding.
2. **Extract metadata.** Duration, resolution, codec, frame rate, and audio tracks are pulled from the source file and recorded against the video's record in Postgres.
3. **Transcode.** This is where FFmpeg does the heavy lifting, producing an adaptive HLS ladder from 360p up to 4K — without ever upscaling a source that doesn't support it, so you're not wasting storage and bandwidth on fake 4K generated from a 720p upload. H.264 is the default codec for maximum compatibility; H.265 with NVENC hardware acceleration is available for teams running GPU-equipped nodes who want smaller files at equivalent quality. A progressive MP4 and an audio-only MP3 are also generated alongside the HLS renditions, along with support for defining sub-clips.
4. **Generate HLS.** The transcoded renditions are packaged into HLS segments and manifests — already using CMAF/fMP4 packaging, which is the same segment format DASH uses, meaning a future DASH manifest is largely a packaging-layer addition rather than a re-encode.
5. **Thumbnails.** A poster frame, a set of sampled frames across the video's duration, and a storyboard sprite sheet with a matching WebVTT file are generated — the same storyboard-scrubbing UI you're used to seeing on YouTube and Netflix when you hover over the seek bar.
6. **Transcript.** WhisperX produces word-level transcripts, exported as VTT and SRT, with optional speaker diarization for multi-speaker content. From there, manual chapters can be added, and — if you opt in — an AI layer can generate titles, descriptions, tags, and chapter markers automatically from the transcript and video content.
7. **Store assets.** Every generated artifact — HLS segments, thumbnails, the storyboard sprite, transcripts — is written to your S3-compatible storage zone.
8. **Emit webhook.** An HMAC-signed webhook fires so your application knows processing is complete, without you needing to poll the API.
9. **Mark ready.** The video's status flips to ready, and the signed master playlist URL you received at creation time becomes a live, playable stream.

The entire sequence is visible, inspectable, and — because it's Apache-2.0 — modifiable. If you need a thirteenth step in that pipeline for your specific use case, you're not filing a feature request; you're opening a pull request against your own fork, or just editing the worker directly.

It's also worth calling out what's off by default, because a platform that turns everything on by default is a platform that's slow and expensive by default. AI-generated metadata, speaker diarization, H.265/NVENC encoding, loudness normalization, and an SVT-AV1 encoding tier are all real, shipped capabilities — they're just config- and hardware-gated, so you opt into the compute cost only when you actually need the feature.

## Playback That Never Leaks Your Origin

Encoding a video is only half the job — serving it safely and efficiently is the other half, and it's where a lot of homegrown video setups quietly fall apart. OllaNode's approach here is deliberately paranoid, in a good way.

The core principle: **bytes are never served direct.** The `playback-service` proxies and rewrites every single HLS URI — master playlist, variant playlists, individual segments — through itself. Your actual storage origin, wherever it physically lives, is never exposed to a client. This one architectural decision closes off an entire category of problems: no one can discover your S3 bucket URL from a video tag, no one can bypass your access controls by hitting storage directly, and you can rotate or migrate your storage backend without breaking a single existing playback URL.

On top of that private-origin proxy sits a signed, expiring token system. Every master and variant URI carries an HMAC token, and the default policy is fully signed with optional revocation lookup — meaning you can invalidate a specific playback session even after a token has already been issued, which matters if you're building anything with per-session access control, like a course platform revoking access when a subscription lapses mid-stream.

For content that needs an extra layer of protection — think premium or licensed material — OllaNode supports AES-128 HLS encryption, with a per-video key delivered via the standard `#EXT-X-KEY` tag and token-gated key delivery, so even someone who captures the encrypted segments can't decrypt them without a valid, still-active token.

And because most teams don't want to hand-roll a video player from scratch, OllaNode ships an embeddable Vidstack-based player at `/embed/:id`, complete with a quality selector, storyboard scrubbing, chapter navigation, and captions — drop it in an iframe and you have a production-grade playback experience without writing a line of player code.

## More Than Video: CDN, Storage, DNS, and Edge Functions

Here's the part that tends to surprise people who assume OllaNode is "just" a video encoder with a nice API. It isn't. The same control plane that runs your transcoding pipeline also runs the delivery network underneath it, which is a meaningfully different design decision than bolting a third-party CDN in front of a video service.

### CDN pull zones
OllaNode runs multi-tenant CDN pull zones on an OpenResty edge layer, routed by Host header. Each zone gets its own TTL configuration, CORS rules, and edge rules, plus hotlink token signing to stop other sites from leeching your bandwidth. Purging is available at both the full-zone level and the path-granular level — a full purge bumps a cache version, so the very next request is guaranteed to be a cache MISS (and correctly repopulates as a HIT afterward), which is a subtly important detail if you've ever fought with a CDN that claims to purge but quietly keeps serving stale edge cache for another twenty minutes. Live traffic analytics are available per zone.

### Storage and the image optimizer
Underneath the CDN sits S3-style storage zones with presigned upload support, so your application can hand a client a direct, time-limited upload URL without routing bytes through your own servers. Layered on top is a signed, on-the-fly image optimizer powered by imgproxy — resize, reformat, and adjust quality via URL parameters, with real gains: a 30 KB JPEG poster frame can come back as a 2.9 KB WebP at 200px width, resized and reformatted in-flight rather than pre-generated and stored as a dozen separate variants.

### Authoritative DNS
Perhaps the most unusual capability on the list: OllaNode runs its own authoritative DNS server, built on Hickory, serving A, AAAA, CNAME, TXT, MX, and NS records straight out of Postgres on port 53, over both UDP and TCP. If you're already running your own CDN and storage, owning your DNS zones too closes the loop — your entire delivery stack, from resolution to origin to edge cache, sits on infrastructure you operate.

### Edge functions
Finally, edge functions: deploy JavaScript or TypeScript and have it execute at the edge inside a V8 isolate, right next to your cache — no cold container starts, no separate serverless platform to wire up and bill separately. A request to `GET /__fn/<id>` runs your code in an isolate and returns a response, which is the same fundamental model as Cloudflare Workers, just running on infrastructure you own. There's also a per-project KV store that your edge functions and dashboard both read and write to, for the kind of lightweight state edge functions typically need — feature flags, rate-limit counters, cache-busting tokens.

Put together, this means a team adopting OllaNode isn't just replacing a video vendor — they're often consolidating a video vendor, a CDN vendor, an object storage vendor, and a DNS provider into a single self-hosted control plane with one API and one bill: your server costs.

## Built for AI agents with our [AI agent security model](/blog/ai-agent-security-model-least-privilege-scopes-audit-trails), With Guardrails

We built OllaNode in 2026, which means we built it in a world where AI agents routinely call APIs on behalf of humans — provisioning infrastructure, uploading content, purging caches, deploying edge functions. Pretending that isn't happening, or bolting on agent support as an afterthought, felt like designing for a world that no longer exists.

So OllaNode treats agents as first-class, API-first citizens — with guardrails that specifically distinguish "an agent read some data" from "an agent just deleted a production CDN zone."

The model works like this: an agent calls `GET /v1/whoami` and receives back not just an identity, but a full capability map — exactly which actions this credential is allowed to take. Read operations and non-destructive writes proceed immediately. But destructive actions and code-deployment actions — deleting a video, purging an entire CDN zone, deploying a new edge function — don't execute on the first call. They route through an approval gate: the agent's request returns a 202 with an `approval_id`, a human reviews and approves it in the dashboard, and only then does the agent replay the request with an `X-Approval-Id` header to actually execute it — once.

Every action, gated or not, writes into a tamper-evident, hash-chain audit log that can be independently verified via `GET /v1/audit/verify`, so "what did the agent actually do last Tuesday" is always an answerable, provable question rather than a guess based on scattered logs. And if something goes wrong — an agent misbehaving, a compromised key, anything — there's a literal kill-switch that disables all agent access platform-wide in one call, plus a standing rule that certain categories of action (team management, API key issuance, organization settings) are human-only, returning a 403 to any agent credential regardless of its scopes, no exceptions.

The API is described machine-readably via OpenAPI 3.1 at `GET /openapi.json`, and MCP (Model Context Protocol) support means agent frameworks can discover and call OllaNode's capabilities using the same standard that's rapidly becoming how AI tools talk to external systems.

## Why Apache-2.0 and Permissive OSS Matter

This is worth its own section because it's a decision we get asked about often, and it wasn't casual.

OllaNode itself is licensed under **Apache-2.0** — a genuinely permissive license that lets you use, modify, fork, and even commercially redistribute the platform without the copyleft obligations that come with licenses like AGPL. That last point is the one worth dwelling on, because it's also a filter we applied to every dependency underneath OllaNode, not just the top-level project.

**No AGPL, anywhere in the stack.** AGPL is a fine license with a legitimate purpose, but it comes with a specific, viral obligation: if you modify AGPL-licensed software and make it available over a network — which is exactly what running a self-hosted platform for other people to use *is* — you may be obligated to release your modifications' source code too. For a platform explicitly designed to be self-hosted, modified, and operated by other companies, sometimes on behalf of their own customers, that obligation is a landmine. We didn't want anyone building on OllaNode to have to consult a lawyer before they could ship a customization.

So every dependency was chosen with that filter applied: SeaweedFS, imgproxy, tusd, Coraza, Hickory, and Vidstack are all permissively licensed. You can trace the license of every component in the stack, and the answer is consistently "permissive," not "permissive, except for that one service you didn't think to check."

Practically, this means you can:

- Read the entire source and understand exactly what your video data touches
- Modify the pipeline, the API, or the edge layer to fit requirements a vendor would never prioritize
- Deploy OllaNode inside a client's infrastructure as part of a commercial product, without copyleft strings attached
- Fork it entirely if our roadmap ever diverges from what you need

That last point matters more than it might seem. A lot of "open-source" infrastructure software is really "source-available, until the license changes" — a pattern that's become common enough in the last few years that experienced engineering teams now check licensing before they check features. Apache-2.0 is a commitment that doesn't have an asterisk.

## Getting Started in One Terminal Window

We tried to make the on-ramp as short as the pitch. If you've got a machine with at least 8 vCPUs and 16–32 GB of RAM — a GPU is recommended if you plan to use WhisperX transcription or NVENC-accelerated encoding, but isn't required to get started — here's the entire bring-up sequence:

```bash
$ cp .env.example .env && make infra-up && make migrate && make run-gateway
```

That's it. `infra-up` brings up Postgres, NATS, and your object store; `migrate` runs the schema migrations; `run-gateway` starts the API. From there, you create a project, generate an API key, and you're issuing the same `POST /v1/videos` call shown earlier in this post against your own infrastructure.

If you'd rather not provision servers yourself, the same platform is available as a managed offering — we operate OllaNode on your cloud account, you keep full ownership of your data, and you get provisioning, upgrades, monitoring, multi-region edge points of presence, and an SLA with priority support layered on top. Both tiers run identical software; managed simply means we handle the operational burden instead of you. There's no metered, per-minute pricing in either case — self-host is free software, and managed is a flat conversation with our team based on your footprint, not your bandwidth.

## What OllaNode Is Not (Yet)

We'd rather tell you the honest edges up front than let you discover them after you've integrated:

- **There's no live streaming.** OllaNode is a VOD (video-on-demand) pipeline. There's no RTMP ingest and no live-streaming support today. If your product needs live video, OllaNode isn't the right tool yet — though it's a space we're watching closely, and the same async, event-driven architecture that runs the VOD pipeline is a reasonable foundation for it later.
- **It's HLS, not DASH — yet.** Segments are already packaged as CMAF/fMP4, which is DASH-compatible packaging, so the remaining work for DASH support is a manifest-generation layer rather than a re-encode of your entire library. It's on the roadmap, but it isn't shipped today.
- **There's no built-in billing system.** This one is really a feature described as a limitation: because OllaNode is self-hosted software rather than a metered SaaS product, there's no per-minute billing (see [why we built an open-source Mux alternative](/blog/why-we-built-open-source-mux-alternative-in-rust)) engine baked into the platform, because there's nothing to meter — your cost is your own infrastructure spend, full stop.

We'd rather you know these boundaries from a blog post than from a support ticket.

## Who This Is For

OllaNode isn't trying to be the right answer for every team shipping video. If you need a live-streaming platform today, or you'd genuinely rather never think about servers, a managed vendor is still a completely reasonable choice. But we built this for a specific set of people who kept showing up in our own conversations and in the broader developer community:

- **Platform and infrastructure teams** at companies where video is core to the product — course platforms, creator tools, internal media libraries — who've outgrown "just use a vendor" and need the cost curve and data ownership that only self-hosting provides.
- **Agencies and consultancies** building on behalf of clients with strict data-residency or compliance requirements, where "your video lives in our vendor's cloud" isn't an acceptable answer, but "it's Apache-2.0 software running in a VPC you control" is.
- **Startups that are cost-conscious early** and expect to scale.Per-minute vendor billing can remain attractive at low volume but may become a significant operating cost as video catalogs and viewing activity grow.; self-hosted infrastructure inverts that curve — higher fixed cost of ownership, but a marginal cost per video that approaches your raw compute and storage price.
- **Teams building AI-native products** that need agents to provision, manage, and interact with video infrastructure programmatically, with an approval and audit model that a compliance team can actually sign off on — not a bolt-on afterthought.
- **Developers who simply want to read the code.** Some of you just want to know, precisely, what happens to a file the moment it leaves your curl command. Apache-2.0 means you always can.

## Frequently Asked Questions
 
<div class="faq-section-container">

### 1. Is OllaNode really free to use?

The self-host tier is free, full-stop — the complete platform, unlimited videos, zones, and projects, with community support. The cost you take on is your own infrastructure: the servers, storage, and bandwidth you provision to run it. If you'd rather not manage that infrastructure yourself, the managed offering on ollanode.com puts the OllaNode team in charge of operations on your cloud account, priced through a direct conversation rather than a metered plan.

### 2. What hardware do I need to self-host it?

The recommended baseline is 8 or more vCPUs and 16–32 GB of RAM. A GPU is recommended, not required, for hardware-accelerated features like WhisperX speech transcription and NVENC encoding — you can run entirely on CPU if those specific features aren't part of your workflow yet. Explore hardware recommendations on the OllaNode [documentation](https://ollanode.com/docs).

### 3. How is this different from just running FFmpeg on a server myself?

FFmpeg is one component inside a much larger system. OllaNode wraps it in a full asynchronous pipeline — event-driven job orchestration, adaptive ladder generation, thumbnail and storyboard extraction, transcription, signed private-origin delivery, an edge CDN, S3 storage zones, authoritative DNS, edge functions, and an API layer with authentication, rate limiting, and webhooks. It's the difference between having a video encoder and having a complete video platform.

### 4. Does OllaNode support live streaming?

Not currently. OllaNode is purpose-built as a VOD (video-on-demand) pipeline, and there's no RTMP ingest or live-streaming support today. It's a capability we're evaluating for the future, but we'd rather be upfront that it isn't there yet than let you find out mid-integration.

### 5. Is HLS the only streaming format available?

Today, yes — HLS is the only manifest format OllaNode produces. The underlying segments are already packaged as CMAF/fMP4 video segments, which is the same format DASH uses, so DASH support is a planned addition rather than a fundamental rework.

### 6. Can I use my existing CDN or storage instead of OllaNode's?

OllaNode is designed as a unified stack — video, CDN, storage, and DNS sharing one control plane — which is a big part of the value proposition. That said, because it's Apache-2.0 open source, you have complete freedom to modify the storage or delivery adapters to point at infrastructure you already run, since the domain core is decoupled from any specific infrastructure adapter by design.

### 7. How does the AI-agent governance model actually stop an agent from doing something destructive?

Any action classified as destructive or code-deploying — deleting resources, purging entire CDN zones, deploying new edge functions — doesn't execute on an agent's first call. The API returns a 202 with an `approval_id` instead of performing the action. A human has to review and approve that request in the dashboard before the agent can replay it with an approval header to actually execute it, and it can only run once per approval. Certain categories, like team and API key management, are blocked to agents entirely, regardless of the scopes on their credential.

### 8. What license is OllaNode released under, and does that extend to its dependencies?

OllaNode itself is Apache-2.0 licensed. Every dependency in the stack — SeaweedFS, imgproxy, tusd, Coraza, Hickory DNS, Vidstack, and the rest — was deliberately chosen to be permissively licensed as well, with a hard rule against including any AGPL-licensed component anywhere in the platform.

### 9. Is OllaNode built with a specific programming language or framework?

It's a Rust workspace built on the Axum web framework, structured as 11 shared library crates and 9 independently deployable services, following clean architecture principles where the domain core has no I/O and all external systems are accessed through adapters implementing defined ports.

### 10. How do I get started?

The fastest path is the four-command bring-up sequence — `cp .env.example .env && make infra-up && make migrate && make run-gateway` — followed by creating a project and API key in the dashboard. From there, the OllaNode quickstart guide walks through your first video upload and playback URL end to end, and you can start free whenever you're ready. For enterprise assistance, our team is available to help design your deployment.

</div>

## Conclusion
OllaNode is a self-hosted video infrastructure platform for developers who want greater control over video processing, storage, HLS delivery, CDN infrastructure, and supporting services.
Its approach combines VOD processing, adaptive HLS, storage, CDN delivery, DNS, edge functions, and API-driven workflows under infrastructure that teams can operate and modify themselves.
For teams evaluating self-hosted video infrastructure, the main trade-off is clear: self-hosting requires more operational responsibility, but it can provide greater control over deployment, data, customization, and infrastructure ownership.

---
