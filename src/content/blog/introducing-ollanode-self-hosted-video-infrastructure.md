---
title: "Introducing OllaNode: Self-Hosted Video Infrastructure for Developers"
category: "Product & Changelog"
excerpt: "Discover OllaNode, an Apache-2.0 self-hosted video infrastructure platform with VOD, HLS, CDN, storage, DNS, edge functions, and AI-agent governance."
author:
  name: "The OllaNode Team"
  role: "Core Team"
  avatar: "⚡"
publishedDate: "August 21, 2026"
readingTime: "8 min read"
tags: ["VOD", "HLS", "CDN", "Self-Hosted", "Rust", "AI-Agents", "Apache-2.0"]
featured: true
---

Every developer who has ever shipped a "video" feature knows the moment. The demo works beautifully on your laptop with a single MP4 file, and then someone asks the question that changes everything: *"What happens when 10,000 people upload videos at once?"* Suddenly you're not building a feature anymore — you're building a video platform. And building a video platform from scratch means transcoding pipelines, adaptive bitrate ladders, thumbnail generation, a CDN, signed URLs, storage that doesn't fall over, and an [authoritative DNS](/docs/dns) layer that actually resolves under load.

Most teams don't build that. They reach for a vendor — Mux, Cloudflare Stream, Bunny.net, or one of a dozen similar platforms — hand over their video files, and pay per minute of storage and per minute of streaming, forever, on infrastructure they will never see or touch.

That works, right up until it doesn't. The bill grows with your usage in a way that never quite feels proportional. Your video data — the single most expensive-to-produce asset in a media product — lives entirely inside someone else's account. And if you need something the vendor doesn't offer — a custom edge rule, a different storage backend, a governance model for [AI agents](/docs/agents) touching your infrastructure — you're stuck filing a feature request and waiting.

This is the gap we built **OllaNode** to close.

OllaNode is a self-hosted, API-first video, CDN, storage, DNS, and [edge compute](/docs/edge-functions) platform, licensed entirely under **Apache-2.0**, that you run on your own hardware. Think of it as the Mux / Cloudflare Stream / Bunny.net feature set — ingest, transcode, thumbnail, transcript, deliver — minus the vendor, minus the per-minute invoice, minus the black box. One project-scoped [REST API](/docs) in front of a pipeline you can read, audit, fork, and operate yourself.

This is our first blog post, so consider it both an introduction and an invitation: here's what OllaNode is, why we built it the way we did, and how you can have your own video stack running before your coffee gets cold.

---

## What Is Self-Hosted Video Infrastructure?

Self-hosted video infrastructure means running the systems that process, store, secure, and deliver video on infrastructure you control instead of relying entirely on a managed video provider. Depending on the workload, that can include [video ingestion & transcoding](/docs/vod), adaptive bitrate packaging, object storage, CDN delivery, playback security, APIs, authoritative DNS, and background job orchestration.

Self-hosting is not automatically the right choice for every team. It becomes especially relevant when data ownership, deployment control, customization, predictable infrastructure costs, or compliance requirements matter enough to justify operating the underlying stack. OllaNode is designed for that audience: developers and teams who want the convenience of a unified video platform without giving up control of the infrastructure underneath it.

**Quick answer: What is OllaNode?**
OllaNode is a self-hosted, API-first video infrastructure platform for developers. It combines VOD processing, HLS delivery, [OpenResty CDN](/docs/cdn), storage, Hickory DNS, V8 edge functions, webhooks, security, and AI-agent governance under one control plane that you can run and modify on your own infrastructure. Learn more on our [Homepage Platform Overview](/#platform-capabilities) or explore [OllaNode Pricing](/pricing).

---

## Key Takeaways

<div class="key-takeaways-box">

1. **Full Control**: OllaNode is a self-hosted video infrastructure platform built for developers who want complete control over their video stack. Explore our [How It Works Architecture](/#how-it-works).
2. **Unified Stack**: It combines VOD processing, HLS delivery, CDN, [Storage](/docs/storage), DNS, and edge functions in one control plane.
3. **Async Pipeline**: The VOD pipeline is asynchronous and event-driven, covering transcoding, HLS generation, thumbnails, transcripts, storage, and webhooks.
4. **Apache-2.0 License**: Permissive open-source licensing allows teams to inspect, modify, fork, and commercially deploy OllaNode.
5. **AI-Agent Governance**: Workflows include security guardrails such as scoped capabilities, approval gates, audit logging, and human-only actions (see [Agent-Native Guardrails](/#agent-native)).

</div>

---


## The Problem With Renting Your Video Infrastructure

Let's be fair to the incumbents first. Managed video platforms exist because video is genuinely hard. Encoding is CPU- and GPU-intensive. Adaptive bitrate streaming requires a real pipeline, not a single ffmpeg command. Serving video at scale needs a CDN with proper cache invalidation, not a static file server. Getting all of this right takes years of engineering.

But "accessible" and "yours" are different things. A few realities tend to surface once a product with vendor-hosted video actually grows:

- **The billing model punishes success**: Per-minute storage plus per-minute delivery sounds simple until your catalog and your audience both grow at once. The bill doesn't scale with your revenue — it scales with your usage.
- **Your data lives in someone else's account**: Every video you've ever processed, every transcript, every thumbnail — it's sitting inside a third party's infrastructure. Migrating away later means re-encoding your entire library.
- **You inherit their roadmap, not yours**: Need a custom cache rule at the edge? A different storage backend? A specific encryption policy for HLS segments? You file a ticket and wait.
- **Compliance gets complicated fast**: Regulated industries — healthcare, finance, government, education — often need to know exactly where video data sits and how it's encrypted. Review our [Security & WAF Controls](/docs/security).

OllaNode is what we wished existed when we were in that position.

---

## What Is OllaNode?

At its core, OllaNode is a self-hosted video and delivery platform that behaves like a Mux- or Bunny.net-class product, except it runs entirely on infrastructure you control, released under the **Apache-2.0** license.

It ingests a video, transcodes it to an adaptive HLS ladder from 360p up to 4K, extracts thumbnails and a storyboard sprite, generates word-level transcripts, and serves signed, expiring playback — all behind a single project-scoped REST API.

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

That's the entire mental model. You `POST` a video, the pipeline does the rest asynchronously, and you get back a signed master playlist URL you can hand to any HLS-compatible player.

---

## Under the Hood: A Rust Workspace, Not a Monolith

The whole platform is a Cargo workspace built in Rust on Axum: 11 library crates and 9 independently-deployable services. Every adapter that talks to Postgres, S3, NATS, or FFmpeg implements a port defined by that core.

The technology choices are deliberately battle-tested:
- **Axum & Tokio**: For the high-concurrency HTTP API layer
- **PostgreSQL**: System of record
- **NATS JetStream**: Event and job backbone (with Temporal available as a drop-in option)
- **S3-compatible storage**: Commonly SeaweedFS for self-hosted clusters
- **FFmpeg & WhisperX**: For VOD transcoding and word-level speech transcription
- **imgproxy**: For [On-The-Fly Image Optimization](/docs/optimizer)
- **Hickory**: Authoritative DNS server
- **V8 Isolates**: For running edge functions

---

## OllaNode's VOD Pipeline: One Upload, a Full Production Line

Every video upload triggers an event-driven sequence:

`upload_completed → validate → extract_metadata → transcode → generate_hls → thumbnails → transcript → store_assets → emit_webhook → mark_ready`

1. **Validate**: Checks file integrity before expensive GPU/CPU work begins.
2. **Extract Metadata**: Duration, resolution, codec, and audio tracks are saved.
3. **Transcode**: FFmpeg produces an adaptive HLS ladder (360p up to 4K) using H.264 or NVENC H.265.
4. **Generate HLS**: Packaged into fMP4/CMAF manifests.
5. **Thumbnails**: Storyboard sprite sheet and WebVTT seeking previews are generated.
6. **Transcript**: WhisperX produces SRT/VTT transcripts with optional speaker diarization.
7. **Store Assets**: Written directly to your S3 storage zone.
8. **Emit Webhook**: HMAC-signed [webhooks](/docs/webhooks) notify your application when complete.
9. **Mark Ready**: Status flips to ready and playback begins.

---

## Playback That Never Leaks Your Origin

Bytes are never served direct. The playback-service proxies and rewrites every single HLS URI — master playlist, variant playlists, individual segments — through itself. Your actual S3 origin URL is never exposed to a client.

On top of that private-origin proxy sits a signed, expiring token system with AES-128 HLS segment encryption, ensuring your media remains protected. Inspect [Delivery & Edge Infrastructure](/#delivery-edge).

---

## More Than Video: CDN, Storage, DNS, and Edge Functions

- **CDN Pull Zones**: Multi-tenant OpenResty edge layer with per-zone TTL, CORS rules, hotlink signing, and instant cache purge.
- **Storage & Image Optimizer**: Presigned uploads backed by imgproxy on-the-fly image resizing.
- **Authoritative DNS**: Hickory-powered DNS server answering A, AAAA, CNAME, TXT, MX, and NS records on port 53.
- **Edge Functions**: Deploy TypeScript/JavaScript executing at the edge inside V8 isolates.

---

## Built for AI Agents, With Guardrails

OllaNode treats AI agents as first-class citizens. Destructive or code-deploying actions — such as deleting a CDN zone or deploying an edge function — route through an **approval gate** (`202 Accepted` with an `approval_id`) requiring human verification before execution.

All agent interactions are logged in a tamper-evident audit trail (`GET /v1/audit/verify`).

---

## Why Apache-2.0 and Permissive OSS Matter

OllaNode and every single dependency in its stack are licensed under **Apache-2.0** or compatible permissive open-source licenses. There is **no AGPL** anywhere in the codebase.

This guarantees you can:
- Inspect every line of code running your video infrastructure
- Modify pipelines and edge rules without vendor permission
- Commercially deploy OllaNode for your clients without copyleft restrictions
- Fork and operate independently whenever you need

---

## Getting Started in One Terminal Window

To launch the full stack on a machine with 8+ vCPUs and 16GB+ RAM:

```bash
cp .env.example .env && make infra-up && make migrate && make run-gateway
```

---

## Who This Is For

- **Platform & Engineering Teams** building media apps who want predictable infrastructure costs and full data ownership.
- **Agencies & Enterprise Consultancies** serving clients with strict data residency or compliance mandates.
- **Startups & Scaleups** looking to bypass per-minute vendor invoices.
- **AI Developers** deploying autonomous agents with strict security guardrails.

---

## Frequently Asked Questions

### 1. Is OllaNode really free to use?
Yes! The self-hosted tier is 100% free under the Apache-2.0 license with unlimited videos, zones, and projects. You only pay for your underlying cloud servers or hardware.

### 2. How does OllaNode compare to running FFmpeg manually?
OllaNode provides a complete event-driven video platform — combining HLS packaging, CDN, DNS, Edge Functions, and Agent Governance behind a unified REST API.

### 3. What hardware do I need to self-host it?
The recommended baseline is 8 or more vCPUs and 16–32 GB of RAM. A GPU is recommended for WhisperX transcription and NVENC encoding.

### 4. Does OllaNode support live streaming?
Not currently. OllaNode is purpose-built as a VOD (video-on-demand) pipeline.

### 5. Is HLS the only streaming format available?
Today, yes — HLS is the default format, with DASH manifest support on the roadmap.

### 6. Can I use my existing CDN or storage instead of OllaNode's?
Yes, OllaNode's domain core is decoupled from infrastructure adapters so you can plug in existing S3 buckets or CDN layers.

### 7. How does the AI-agent governance model stop an agent from doing something destructive?
Destructive actions return a `202 Accepted` with an `approval_id` requiring human confirmation before execution.

### 8. What license is OllaNode released under?
OllaNode and all underlying stack dependencies are permissively licensed under Apache-2.0.

### 9. How do I get started?
Run `cp .env.example .env && make infra-up && make migrate && make run-gateway` to bring up the full platform locally.
