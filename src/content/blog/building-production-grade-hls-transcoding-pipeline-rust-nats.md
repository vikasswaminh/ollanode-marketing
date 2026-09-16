---
title: 'Building a Production-Grade HLS Transcoding Pipeline with Rust and NATS Jetstream'
description: "Transcoding looks simple in a demo and turns into an engineering org's biggest headache in production. Here's how we designed a fault-tolerant HLS pipeline using Rust and NATS JetStream."
category: 'Engineering'
pubDate: 2026-08-31
author: 'The OllaNode Team'
tags: ['Engineering', 'Rust', 'NATS-JetStream', 'HLS', 'Transcoding', 'VOD', 'Distributed-Systems']
---

There is a version of every video platform's origin story that goes like this: someone wires FFmpeg behind an API endpoint, the endpoint transcodes a video synchronously, everyone claps, and the demo ships. Then real files show up — a ninety-minute lecture recording, a vertical phone clip, a four-hour Twitch VOD, a corrupted upload with a malformed moov atom — and the wrapper falls over, one request at a time, until someone gets paged (see [video processing monitoring](/blog/video-processing-monitoring-how-to-detect-stuck-failed-and-delayed-transcoding-job)) because the API process ran out of memory holding open concurrent encodes.

That is roughly how we ended up rebuilding our transcoding pipeline three times before calling it production-grade. This post is about the third version — the one we actually run. It covers why we moved the pipeline onto Rust, why we picked NATS JetStream as the backbone instead of Kafka or SQS, how the job lifecycle is modeled, and the failure modes that shaped nearly every design decision.

This is not a theoretical architecture. It is the pipeline behind [OllaNode](https://ollanode.com/#platform-capabilities)'s [VOD processing and self-hosted video APIs](/blog/sel-hosted-video-api-upload-processing-playback-webhooks-ans-asset-lifecycles), explained the way we'd walk a new infrastructure engineer through it.

---

## Quick Answer: What Does a Production HLS Pipeline Actually Need?

A production-grade [dynamic HLS transcoding](/blog/how-to-generate-dynamic-hls-resolution-ladders) pipeline needs four things a script wrapping FFmpeg doesn't give you by default:
1. Asynchronous job orchestration
2. Durable at-least-once delivery with idempotent workers
3. Backpressure-aware scaling
4. Observability into every stage of a video's journey from upload to a playable manifest

Concretely: a Rust control plane owning job state, validation, and the API surface; NATS JetStream as the durable event backbone connecting ingestion, transcoding, packaging, and delivery; FFmpeg workers treated as untrusted, restartable subprocesses rather than an in-process library call; a rendition ladder computed per source video instead of a fixed output list; CMAF/fMP4 packaging into HLS manifests, landing in object storage; and structured retries, dead-letter queues, and tracing so a stuck job is a metric, not a mystery.

<div class="key-takeaways-box" id="key-takeaways">
  <div class="key-takeaways-header">
    <span class="key-takeaways-icon">✦</span>
    <h3 class="key-takeaways-title">KEY TAKEAWAYS</h3>
  </div>
  <ul class="key-takeaways-list">
    <li><strong>Transcoding is a workflow, not a function call.</strong> Treating it as a synchronous API request is the most common design mistake in early video platforms. Review our VOD Pipeline Documentation on ollanode.com.</li>
    <li><strong>Rust earns its keep in the control plane</strong> — not because FFmpeg gets faster, but because job orchestration and concurrency matter when hundreds of workers coordinate state.</li>
    <li><strong>NATS JetStream gives durable, replayable, backpressure-aware messaging</strong> with far less operational weight than Kafka and far more durability than a plain queue alone.</li>
    <li><strong>Idempotency is not optional.</strong> At-least-once delivery means every stage must be safe to run twice.</li>
    <li><strong>Observability is the actual deliverable.</strong> A pipeline you can debug at 2 a.m. matters as much as one that works on the happy path.</li>
  </ul>
</div>

## Why Transcoding Is the Hardest Part of a Video Platform

Every part of a video platform sounds achievable in isolation. Uploading a file is solved. Storing an object is solved. Serving a manifest is solved. Transcoding resists that framing because it sits at the intersection of unpredictable input, expensive compute, and a user refreshing a status page waiting for a checkmark.

Source video is adversarial in ways most backend engineers don't expect until they've been burned by it. Codecs vary — H.264, HEVC, VP9, AV1, ProRes, and the occasional container full of corrupted frames. Resolutions range from 240p phone recordings to 8K drone footage. Frame rates are inconsistent, sometimes variable within a single file. Rotation metadata lies, and duration metadata lies more.

The second reason is resource shape. Encoding is CPU- and GPU-bound, and bursty. Transcoding load spikes whenever an instructor uploads lectures on a Sunday night, or a media company ingests an entire back catalog at once.

The third reason is that transcoding is a multi-stage workflow with real dependencies. You cannot package HLS before renditions exist, and you cannot fire a "ready" webhook before every rendition has landed in storage. Adversarial input, bursty compute, and dependency graphs together produce a system that behaves like a distributed workflow engine that happens to shell out to FFmpeg.

---

## The Anatomy of an HLS Transcoding Pipeline

Before discussing Rust or JetStream specifically, it helps to lay out the stages a video passes through:

$$\text{Upload} \rightarrow \text{Validate} \rightarrow \text{Probe} \rightarrow \text{Plan Ladder} \rightarrow \text{Transcode Renditions} \rightarrow \text{Package HLS} \rightarrow \text{Thumbnails} \rightarrow \text{Store} \rightarrow \text{Webhook} \rightarrow \text{Ready}$$

- **Upload** writes bytes to durable storage before anything else happens.
- **Validate** rejects malformed containers early, before burning CPU.
- **Probe** extracts real metadata from the file itself.
- **Plan Ladder** decides which renditions actually make sense for this source.
- **Transcode Renditions** is the CPU-heavy stage where workers produce each rendition in parallel.
- **Package HLS** assembles finished renditions into segmented CMAF output with a master manifest.
- **Thumbnails & Transcripts** run concurrently with transcoding.
- **Store** uploads assets to S3 storage zones.
- **Webhook & Ready** notify the application and mark the asset playable.

The key insight is that this is a graph with fan-out and fan-in, not a straight line. Rendition transcoding fans out into N parallel jobs; packaging fans back in, waiting for all of them.

---

## Why We Chose Rust for the Transcoding Control Plane

We want to be precise about what Rust does and doesn't do here: Rust does not make encoding faster — FFmpeg does that work regardless of what language calls it. What Rust changes is everything around the encoding: how jobs are scheduled, how worker state is tracked, how concurrent requests are handled, and how confidently you can reason about a system managing hundreds of long-running subprocess supervisors.

Rust's ownership model forces explicitness about who owns a subprocess handle and what happens when a task is cancelled mid-encode. A worker that doesn't clean up a killed FFmpeg process leaves zombies holding CPU cores. Rust's compiler catches a meaningful fraction of that bug class before it ships.

We also lean on Tokio's async task model to run thousands of lightweight coordination tasks without an OS thread per task. Structurally, the service is a Rust workspace with separated crates for the API, job-state definitions, the JetStream integration, and the FFmpeg supervisor.

---

## Why NATS JetStream Instead of Kafka or SQS

The event backbone determines how every stage talks to every other stage:

- **Against a plain queue:** SQS gives at-least-once delivery, but not a durable, replayable log or multiple independent consumers reading the same stream at different rates.
- **Against Kafka:** Kafka brings real operational weight — a JVM broker cluster, partition management, and ZooKeeper/KRaft coordination.
- **NATS JetStream** ships as a single lightweight binary, clusters for high availability without a separate coordination service, and provides durable streams, configurable retention, consumer groups with acknowledgment semantics, and replay from any point.

The features that matter most:
1. **Durable streams** so events aren't lost if consumers are down.
2. **Pull-based consumers with explicit ack**, so a worker only acknowledges once output is fully written.
3. **Queue groups** for automatic load-balancing.
4. **Subject-based routing**, allowing granular subscriptions like `video.<id>.rendition.<profile>.completed`.

This mirrors the philosophy behind OllaNode's event-driven VOD pipeline, which uses JetStream by default with Temporal available as an optional workflow engine.

---

## Designing the Job Lifecycle: From Upload to Ready

We model every asset as a state machine with named states: `uploaded`, `validating`, `probing`, `queued`, `transcoding`, `packaging`, `finalizing`, `ready`, `failed`. Each transition is triggered by an event on a JetStream subject and recorded both in the durable stream and in a queryable job-state database.

Subject hierarchy namespaces by asset ID and stage:
- `video.{asset_id}.uploaded`
- `video.{asset_id}.rendition.{profile}.completed`
- `video.{asset_id}.ready`

When probing completes, the control plane publishes one `rendition.requested` event per profile (fan-out). A dedicated aggregator subscribes to every `rendition.{profile}.completed` event and, once every expected profile succeeds, publishes `all_renditions_complete`, triggering packaging (fan-in).

---

## The Worker Model: Concurrency Without Chaos

Transcoding workers do the CPU-intensive work and are deliberately simple, stateless, and disposable:
- Each worker pulls jobs from a JetStream consumer group.
- A crashed worker simply stops acknowledging; redelivery hands the job to a different worker once the ack-wait timeout expires.
- Each worker has a bounded concurrency limit — a semaphore capping simultaneous FFmpeg subprocesses, tuned to the host's core count.
- Workers are stateless between jobs, making them safe to kill, restart, or autoscale without a handoff protocol.

---

## Handling FFmpeg as a Subprocess, Not a Library

FFmpeg runs as an isolated subprocess, not linked in-process via FFI. The reasoning is isolation: FFmpeg processes untrusted input and can crash on malformed media. If FFmpeg crashes in-process, it takes the control plane down with it. As a subprocess, the worker just observes a non-zero exit code and moves on.

Each subprocess launches with explicit CPU/memory constraints and a wall-clock timeout scaled to source duration. We also capture FFmpeg's stderr and parse it into structured `rendition.{profile}.progress` events published back to JetStream for real-time progress reporting.

---

## Adaptive Bitrate Ladders: Choosing Renditions That Matter

Our pipeline computes the ladder dynamically after probing, based on actual resolution, bitrate, and content complexity:
- Renditions never exceed source resolution.
- Each step down roughly halves bitrate while adjusting resolution.
- High-motion content (sports, gaming) gets more intermediate rungs.
- Ladder logic lives in the Rust control plane as a pure function of probed metadata, making it exhaustively unit-testable.

---

## Packaging: From Raw Renditions to a Valid HLS Manifest

Once every rendition is transcoded, packaging assembles them into valid, playable HLS:
- **CMAF-compliant fMP4 segments** rather than legacy MPEG-TS, allowing shared segments between HLS and DASH manifests.
- **Six-second segment chunks** by default.
- Correctly populated `BANDWIDTH`, `RESOLUTION`, `CODECS`, and `FRAME-RATE` attributes per variant.
- Alternate-audio playlists via `EXT-X-MEDIA` tags.

---

## Idempotency, Retries, and Exactly-Once-Enough Semantics

JetStream guarantees at-least-once delivery. Every stage of our pipeline is written to be idempotent under redelivery:
- Before transcoding, a worker checks whether expected output already exists with a valid completion marker.
- Before packaging, it checks whether a manifest already exists.
- Webhook delivery is deduplicated with an idempotency key derived from asset ID and state transition.
- For true failures, bounded retries with exponential backoff (typically three attempts) route poisoned jobs to a dead-letter queue.

---

## Backpressure and Autoscaling Workers

JetStream provides natural backpressure at the consumer level: a worker only pulls new messages when it has capacity. Saturated workers stop requesting work rather than crashing from out-of-memory errors.

We monitor pending message count and consumer lag as the primary autoscaling signal for the worker fleet.

---

## Observability: Metrics, Tracing, and Dead Letter Queues

Every service emits structured metrics:
- Jobs processed per stage and duration histograms
- Queue depth and consumer lag
- FFmpeg exit codes and retry counts
- Distributed trace context propagated via message headers
- Dead-letter subjects (`video.{asset_id}.dlq`) storing failed jobs with complete error history

---

## Storage and Output Layout for HLS Assets

Outputs are organized in object storage by asset ID and version:  
`/{asset_id}/{version}/master.m3u8`  
`/{asset_id}/{version}/{profile}/playlist.m3u8`  
`/{asset_id}/{version}/{profile}/segment-{n}.m4s`  
`/{asset_id}/{version}/init.mp4`

Immutable segments cache aggressively with long TTLs at the CDN edge, while playlists use short TTLs to allow instant rollbacks.

---

## Frequently Asked Questions

<div class="faq-section-container">

### 1. What is an HLS transcoding pipeline?

An HLS transcoding pipeline converts an uploaded source video into multiple adaptive-bitrate renditions, segments and packages them per the HTTP Live Streaming spec, and produces a master manifest that players use to stream content, switching quality dynamically based on network conditions. Learn more on ollanode.com.

### 2. Why use NATS JetStream instead of Kafka for video processing?

JetStream provides durable, replayable, at-least-once messaging with consumer groups and backpressure-aware pull consumers, similar in spirit to Kafka's core guarantees, but with much lower operational overhead — a single lightweight binary and simpler clustering. See our architecture breakdown on ollanode.com.

### 3. Why not just call FFmpeg directly from an API endpoint?

It works for short demo clips but breaks in production because encoding time is unpredictable and resource-intensive, from seconds to hours depending on source length. Tying that up in a blocking request produces timeouts, poor resource use, and no way to report progress.

### 4. Is Rust necessary for building a transcoding pipeline?

No single language is strictly necessary — the same patterns work in Go or Java. Rust's advantage is memory safety without a garbage collector plus strong concurrency guarantees, which matter most for a long-running control plane supervising many subprocesses.

### 5. What does "idempotent worker" mean in a transcoding context?

A worker that can safely process the same job message more than once without duplicate or corrupted output — for example, checking whether expected output already exists before re-running an encode. This matters because JetStream guarantees at-least-once delivery.

### 6. How do you handle a video that fails to transcode?

Failed jobs retry a bounded number of times with exponential backoff. If retries are exhausted, the job routes to a dead-letter subject with its full error history attached, rather than being silently dropped, so it stays visible and inspectable.

### 7. What is an adaptive bitrate ladder?

The set of resolution-and-bitrate rendition pairs generated for a source video, letting a player switch quality dynamically based on network conditions. A well-designed ladder is computed relative to the source's actual resolution and complexity rather than applying a fixed set to every upload. Review our transcoding guide on ollanode.com.

### 8. Does this pipeline support live streaming?

No — this architecture is specifically for video-on-demand transcoding. Live streaming introduces additional constraints around ingest protocols, latency, and continuous packaging that require a meaningfully different design.

### 9. How does OllaNode use this architecture?

This is the design behind OllaNode's VOD processing pipeline, which uses NATS JetStream by default for event-driven orchestration, with Temporal available as an optional workflow engine, as part of OllaNode's self-hosted, Apache-2.0 video infrastructure platform on ollanode.com.

### 10. Can I run this kind of pipeline on my own infrastructure?

Yes. Every component described here — the Rust control plane, NATS JetStream, FFmpeg workers, and object storage — is designed to run on infrastructure you control, cloud or bare-metal. Explore self-hosting options on ollanode.com.

</div>

---

## Final Takeaway

The gap between "a script that calls FFmpeg" and a production-grade transcoding pipeline isn't a gap in encoding quality — FFmpeg does that part well either way. It's a gap in how the system behaves under real, messy production conditions: adversarial input, unpredictable job durations, partial failures, deployments mid-flight, and an operator who needs to answer "why is this video stuck" without guessing.

Rust gave us a control plane we could reason about at the systems level. NATS JetStream gave us durable, replayable, backpressure-aware orchestration without the operational weight of a heavier streaming platform. Together, they let us treat transcoding as what it actually is — a distributed, multi-stage workflow — instead of a function call that happens to be slow.

If you're building video infrastructure and want to see this architecture running inside a working, self-hosted platform rather than just a blog post, it powers OllaNode, our open-source, Apache-2.0 video infrastructure platform. Read the VOD pipeline documentation or explore the broader platform architecture to see how transcoding fits alongside storage, CDN, and delivery.

---
