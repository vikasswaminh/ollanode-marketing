---
title: "Step-by-Step: Setting Up Your First Open-Source Video Pipeline with Ollanode"
category: "Guides"
excerpt: "A complete, step-by-step guide to installing, configuring, securing, and scaling your first self-hosted video pipeline with Ollanode — from upload to adaptive HLS delivery."
author:
  name: "The OllaNode Team"
  role: "Core Team"
  avatar: "⚡"
publishedDate: "August 24, 2026"
readingTime: "12 min read"
tags: ["Guides", "VOD", "HLS", "Self-Hosted", "Storage", "CDN", "NATS"]
featured: false
---

Most video infrastructure guides start with an API key and end with a playback URL. What happens in between — encoding, storage, orchestration, delivery, security — is usually hidden behind a managed provider's dashboard, and most developers never actually see it.

This guide takes the opposite approach.

We are going to walk through exactly what it takes to stand up a self-hosted, open-source video pipeline from scratch: installing the software, wiring up storage and job orchestration, uploading your first asset, configuring transcoding, generating adaptive HLS renditions, connecting a CDN, securing playback, and moving it toward a production-ready deployment.

By the end, you will have a working video-on-demand pipeline running on infrastructure you own, built on OllaNode, a self-hosted, API-first video platform written in Rust and released under **Apache-2.0**.

This is a technical walkthrough, not a marketing pitch. Every step includes the trade-offs and common failure points that actually show up during a first setup, so you are not debugging blind at 2 a.m. because a guide left out the one detail that mattered.

---

## Quick Answer: What Do You Need to Set Up an Open-Source Video Pipeline?

### At a Glance

| Question | Quick answer |
| :--- | :--- |
| **Is a GPU required for the first test?** | No. A CPU-only environment is enough for initial validation. |
| **What is the core pipeline?** | Upload → validate → process → transcode → package → deliver → verify playback. |
| **What streaming format does this guide focus on?** | Adaptive HLS. |
| **What storage is appropriate for testing?** | Local storage can be used for initial validation; production requires durable object storage. |
| **What should production add?** | Durable storage, worker scaling, observability, secrets management, redundancy, and automated deployment. |
| **What is the most important security step?** | Verify webhook signatures and use signed playback URLs where content is restricted. |

To set up your first open-source video pipeline with OllaNode, you need a Linux host or container environment, object storage (local disk for testing, S3-compatible for anything real), a job queue (NATS JetStream by default), and the OllaNode services themselves. In short: install OllaNode → configure storage → start the workers → create a project → upload a video → let the pipeline transcode, package, and deliver it as adaptive HLS.

The whole process, on a single machine, typically takes under an hour for a first working pipeline. Scaling to production traffic is a separate, later phase, covered in Step 12 and the scaling section below. Treat local setup and production readiness as two different milestones — conflating them is the most common reason first attempts stall out. Review our [Quickstart Developer Docs](/docs/quickstart) for immediate setup commands.

---

## Key Takeaways

<div class="key-takeaways-box">

1. **Five Core Layers**: A self-hosted video pipeline has five core layers: ingest, storage, job orchestration, transcoding/packaging, and delivery. Review our [Platform Architecture Overview](/#how-it-works).
2. **Modular Architecture**: OllaNode ships as a Rust workspace, so the control plane runs as a small set of predictable, independently deployable services rather than one monolith.
3. **Automated Flow**: The default pipeline flow is Upload → Validate → Metadata → Transcode → HLS → Thumbnails → Transcript → Storage → Webhook → Ready. See [VOD Processing Pipeline](/docs/processing).
4. **Local First**: Run the entire stack locally for testing before committing to production infrastructure, storage costs, or a CDN contract.
5. **Common Pitfalls**: Most first-time failures come from storage permissions, missing codecs, misconfigured webhooks, or under-provisioned workers — not the platform architecture itself.
6. **Built-in Security**: Security (signed URLs, webhook verification, key rotation) is easier to build in from the start than to retrofit later. Learn more about [Security & Authentication](/docs/authentication).

</div>

---

## What Is a Video Pipeline, and Why Build One Yourself?

A video pipeline is the sequence of systems that take a raw uploaded file and turn it into something a viewer can actually watch: validation, metadata extraction, transcoding into multiple renditions, packaging into a streaming format, thumbnail and transcript generation, storage, and delivery through a CDN.

On a managed platform, this entire sequence is invisible. You call an API, and minutes later a playback ID is ready. That is convenient, but it also means the pipeline's behavior, cost structure, and failure modes are someone else's decisions. If a provider throttles processing during a spike, changes a default bitrate ladder, or deprecates a feature you depend on, you find out after the fact.

Building your own pipeline with OllaNode means every stage runs as software you can inspect, configure, and modify. You decide where files are stored, how aggressively they're transcoded, which renditions are generated, how delivery is cached and secured, and what happens when something fails.

There is also an educational argument here even if you eventually choose a managed provider for production: understanding what happens between "upload" and "playback ID" makes you a better-informed buyer.

This guide assumes you want that control and are comfortable with basic server or container administration. Whether self-hosting is the right call for your project at all is a separate decision — cost, team size, and compliance requirements all factor in, and none are answered by this guide alone.

---

## Understanding the Ollanode Architecture

Before touching a terminal, it helps to know what you are actually deploying. OllaNode is not a single application — it is a set of cooperating services, each responsible for one part of the pipeline.

The API service is the entry point for uploads, asset queries, project management, and webhook configuration.

The job orchestrator sits between the API and the workers. When a video is uploaded, the API publishes a job to the message stream (NATS JetStream by default) and returns immediately, keeping upload requests fast regardless of how long transcoding takes.

Transcoding workers subscribe to that job stream and do the actual encoding, using FFmpeg under the hood. OllaNode's Rust code is the coordination layer: deciding which jobs run, in what order, with what priority, and what happens on failure or retry.

The storage layer holds source files, renditions, thumbnails, and transcripts — decoupled from processing so you can point it at local disk during development and swap in S3-compatible storage later without touching pipeline logic. Learn more in our [Object Storage Docs](/docs/storage).

The delivery layer handles CDN pull-zone configuration, signed URL generation, and cache behavior for the manifests and segments the transcoding stage produces. Read about our [Edge CDN Delivery](/docs/cdn).

Because these are separate services communicating over the job queue rather than one monolithic process, you can scale each layer independently. A spike in uploads means you add transcoding workers; a spike in viewers means you tune CDN caching. Neither requires touching the other. Keep this mental model in mind — each of the next several steps maps directly onto one of these layers.

---

## Before You Start: Prerequisites and System Requirements

Before installing anything, make sure you have the following in place:

- A Linux host (bare metal, VM, or container orchestrator) with at least 4 CPU cores and 8 GB of RAM for a first test environment. Production sizing is a separate calculation, covered later.
- Docker and Docker Compose, or a Kubernetes cluster if you plan to deploy that way from the start.
- Object storage: local disk is fine for testing; an S3-compatible bucket (AWS S3, Cloudflare R2, MinIO, Backblaze B2) is strongly recommended before you touch anything beyond a demo.
- A PostgreSQL-compatible database for project, asset, and playback-policy metadata. Docker Compose will provision one for you locally if you do not already have one.
- A domain or subdomain you control, for playback URLs and CDN configuration later in the guide.
- Basic familiarity with environment variables, reverse proxies, container logs, and reading structured JSON API responses.

You do not need a GPU to get a first pipeline working. GPU acceleration matters once you're transcoding at volume, but CPU-only is enough to validate the whole architecture end to end.

If you're deploying on Kubernetes from day one, this guide's commands still apply conceptually — swap docker compose steps for your Helm chart or manifests, and keep the same environment-variable and storage decisions.

---

## Step 1: Install Ollanode

Start by pulling the OllaNode services. The platform is distributed as a set of containerized services plus a CLI for local development and scripting.

```bash
git clone https://github.com/ollanode/ollanode.git
cd ollanode
docker compose up -d
```

This brings up the core control-plane services: the API, the job orchestrator, the database, the message stream, and the transcoding workers. On first boot, the services will create their local configuration and wait for you to supply storage and environment settings in the next step.

Give the stack a minute to finish initializing, then confirm every service reports healthy:

```bash
docker compose ps
```

You should see the API, database, message stream, and at least one worker container running. If a service is restarting repeatedly, check its logs — a common first-boot issue is the database not being ready before the API connects, which usually resolves after a retry cycle.

---

## Step 2: Configure Storage and Environment Variables

Every OllaNode deployment needs to know where source files, processed renditions, and metadata live. This is set through environment variables or a config file, depending on your deployment method.

At minimum, you will configure:
- **Storage backend** — local filesystem for testing, or S3-compatible credentials for anything beyond a demo.
- **Database connection** — for project metadata, asset records, and playback policies.
- **Base URL** — the domain your API and playback services will be reachable at.
- **Encryption keys** — used for signed playback URLs and webhook payload verification.
- **Job stream connection** — where NATS JetStream is reachable, if you are not using the default Docker Compose network.

A minimal `.env` for local testing might look like:

```env
STORAGE_BACKEND=local
STORAGE_PATH=/data/ollanode
DATABASE_URL=postgres://ollanode:ollanode@db:5432/ollanode
BASE_URL=http://localhost:8080
SIGNING_SECRET=replace-this-with-a-random-32-byte-value
NATS_URL=nats://nats:4222
```

Switch `STORAGE_BACKEND` to `s3` and supply your bucket credentials before you move past local testing. Local disk storage does not survive container rebuilds, has no built-in redundancy, and is not meant for anything beyond initial validation.

A production-oriented `.env` typically adds a few more values:

```env
STORAGE_BACKEND=s3
S3_BUCKET=your-video-bucket
S3_REGION=us-east-1
S3_ACCESS_KEY=your-access-key
S3_SECRET_KEY=your-secret-key
CDN_BASE_URL=https://cdn.yourapp.com
WEBHOOK_SIGNING_SECRET=replace-this-with-a-separate-random-value
```

Keep `SIGNING_SECRET` and `WEBHOOK_SIGNING_SECRET` different — reusing one secret for both means a leak in one system compromises the other.

---

## Step 3: Set Up the Job Orchestration Layer

Video processing is asynchronous by design — you do not want an upload API call to block until transcoding finishes, especially for longer source files. OllaNode uses NATS JetStream by default to coordinate jobs between the API and the worker processes, with Temporal available as an optional workflow engine for teams that need more complex orchestration logic, such as multi-stage approval workflows or cross-system coordination beyond a single pipeline run.

If you used the Docker Compose file from Step 1, NATS JetStream is already running as part of the stack. Confirm it is healthy before moving on:

```bash
docker compose ps
docker compose logs nats
```

You should see the orchestrator connect to the message stream and register its job queues on startup. If those log lines are missing, the orchestrator likely started before NATS was ready — restarting the orchestrator container alone (not the whole stack) usually resolves it.

If workers are not picking up jobs later in this guide, check here first. A queue that accepts jobs but never drains them is a job-orchestration problem, not a transcoding problem: the former looks like "processing" states that never change, while the latter produces explicit failure events.

---

## Step 4: Create Your First Project and API Key

With the services running, create your first project through the OllaNode API or CLI. A project scopes your assets, API keys, webhooks, and playback policies — useful even in a single-app setup, and essential once you have more than one application talking to the same pipeline, or separate staging and production environments sharing infrastructure.

```bash
ollanode projects create --name "my-first-pipeline"
ollanode keys create --project my-first-pipeline
```

Store the returned API key somewhere safe — it authenticates every request against this project. Treat it like a database credential: never commit it to source control, never log it in plaintext, and rotate it before moving to production.

If you plan to run staging and production as separate projects (recommended), create both now with clearly labeled keys. Mixing staging uploads into a production project's asset list is a minor but genuinely annoying cleanup problem later.

---

## Step 5: Upload and Validate Your First Video

Now send a test video through the API. Keep it short for this first pass — a one- to two-minute clip is enough to validate the whole pipeline without a long wait for transcoding.

```bash
curl -X POST https://your-ollanode-host/v1/videos \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -F "file=@test-video.mp4"
```

OllaNode validates the container format, codec, and duration before accepting the file, and returns an asset ID you can use to track processing status. A typical response includes the asset ID, its initial status (usually validating or queued), and a timestamp. See our [Video Management API Docs](/docs/videos).

If validation fails, the API response tells you exactly which check failed — malformed containers and unsupported source codecs are the most common causes. If testing with a file from an unusual tool (some screen recorders produce nonstandard MP4 containers), try re-muxing it with FFmpeg locally first.

Once accepted, poll the asset status endpoint or wait for the webhook in Step 10 to see it move through `validating` → `processing` → `ready`.

---

## Step 6: Configure the Transcoding Pipeline

Once an asset is accepted, it moves into the transcode stage. This is where you decide which renditions get generated — resolution ladder, bitrate targets, and codec settings.

A sensible starting ladder for most on-demand content looks like:
- **1080p** at a moderate bitrate for primary viewing
- **720p** and **480p** for adaptive fallback on slower connections
- **360p** as a floor for mobile or constrained networks

You can configure this ladder per project or per asset, depending on whether your catalog has uniform requirements or needs per-video overrides — for example, higher bitrates for screen-recording content with lots of fine text, or a narrower ladder for short social-style clips where only one or two renditions make sense.

A project-level configuration might look like:

```bash
ollanode projects configure my-first-pipeline \
  --renditions "1080p:4500k,720p:2500k,480p:1200k,360p:600k" \
  --codec h264
```

FFmpeg does the actual encoding work under the hood; OllaNode's job orchestration decides what gets encoded, in what order, and with what priority. If you have both high-priority content (a course that just went live) and low-priority backfill (re-encoding an old catalog), set job priorities so the former does not wait behind the latter.

Codec choice matters too. H.264 remains the safest default for broad device compatibility. If your audience skews modern and bandwidth cost matters more than universal compatibility, evaluate H.265 or AV1 as an addition to, not a replacement for, an H.264 baseline.

---

## Step 7: Generate Adaptive HLS Renditions

After transcoding, OllaNode packages the renditions into adaptive HLS using CMAF/fMP4 segments, which lets a single set of media segments serve multiple manifest profiles efficiently rather than duplicating segment files per format.

You do not need to trigger this manually — it happens automatically as part of the same pipeline job that produced the renditions in Step 6. What you should verify is that the manifest and segment files land where you expect in storage:

```bash
ollanode assets get <asset_id> --show-manifest
```

This returns the master playlist URL along with each variant playlist and its bandwidth value, which is what lets a compliant HLS player choose the right rendition automatically as network conditions change. Check [HLS Playback Docs](/docs/playback).

HLS is currently the supported manifest format. The underlying CMAF/fMP4 packaging lays groundwork for future DASH support, but DASH isn't shipped yet — plan your player integration around HLS.

---

## Step 8: Add Thumbnails and Transcripts

Thumbnails and transcripts are generated as part of the same pipeline run, not as a separate manual step. By default, OllaNode extracts a thumbnail sprite sheet at configurable intervals and, if you have a transcription backend configured, generates a text transcript alongside the video.

Check both are present before moving on:

```bash
ollanode assets get <asset_id> --show-thumbnails --show-transcript
```

Thumbnail intervals are configurable — shorter gives a denser scrubbing preview at the cost of more storage. Five to ten seconds is a reasonable default; dense sprite sheets matter more for long lecture recordings than short clips.

If transcripts are missing, confirm a transcription provider is configured in project settings — this stage is optional. If enabled, budget extra processing time, since transcription runs as its own job after renditions are already available.

---

## Step 9: Connect a CDN for Delivery

Serving HLS segments directly from your origin works for testing, but production playback should go through a CDN — origin-only delivery means every segment request hits your storage layer directly, which doesn't scale. OllaNode includes CDN pull-zone configuration with TTLs, CORS rules, edge rules, and hotlink token signing built in.

To connect a CDN pull zone:
1. Point a subdomain (e.g., `cdn.yourapp.com`) at your OllaNode delivery endpoint.
2. Configure the pull zone's origin to match your storage backend.
3. Set cache TTLs appropriate to your content — long TTLs for immutable segment files (they never change once written), shorter TTLs for manifests if you expect renditions to be regenerated or updated.
4. Configure CORS rules if your player runs in a browser context on a different domain than your CDN.
5. Enable hotlink token signing if you need to prevent playback URLs from being embedded on other sites without authorization.

Once the pull zone is live, your playback URLs should resolve through the CDN domain, not your origin. Test this explicitly — it is easy to have a working CDN configuration that your application code still bypasses because playback URLs were generated before the CDN base URL was set.

---

## Step 10: Set Up Webhooks and Playback Security

Your application needs to know when an asset finishes processing — polling the API works for testing, but webhooks are more efficient and more scalable at any real volume, since they eliminate constant status-polling traffic against your own API.

Configure a webhook endpoint in your project settings, and OllaNode will POST a signed payload when an asset transitions between states (`validating`, `processing`, `ready`, `failed`). Verify the signature on your end using the webhook signing secret you set in Step 2, so you can trust that the webhook actually came from your OllaNode deployment and not a spoofed request hitting your public endpoint. See [Webhooks Configuration Docs](/docs/webhooks).

A minimal webhook handler should:
- Read the raw request body before parsing it as JSON (signature verification needs the raw bytes).
- Recompute the signature using your webhook signing secret and compare it against the signature header.
- Reject the request if the signatures do not match, before doing anything else with the payload.
- Process the event only after verification succeeds.

For playback security, decide now whether your content needs signed playback URLs (expiring, per-viewer tokens) or can be served unsigned. Signed URLs add a little implementation work but are strongly recommended for anything beyond fully public content — course platforms, internal media, and anything paywalled should default to signed URLs rather than adding them later.

Also decide your token expiry window now. Too short, and slow-connection viewers get interrupted mid-playback; too long, and a leaked URL stays valid longer than it should. A window of several hours is a reasonable default, tightened for higher-sensitivity material.

---

## Step 11: Test End-to-End Playback

With the pipeline, CDN, and webhooks configured, run a full end-to-end test:

1. Upload a new test video through the API.
2. Confirm your webhook receives the `processing` and then `ready` events, and that signature verification passes.
3. Load the master HLS playlist URL in a player that supports adaptive bitrate switching (hls.js, native Safari HLS, or a mobile player SDK).
4. Confirm the player is switching renditions correctly as you simulate different network conditions — most browser dev tools let you throttle connection speed for exactly this test.
5. Confirm thumbnails and transcripts (if enabled) are accessible at their returned URLs.
6. Confirm playback URLs resolve through your CDN domain, not your origin, and that signed URLs reject tampered or expired tokens.

If everything on this list works, you have a functioning self-hosted video pipeline, end to end, from upload to adaptive, CDN-delivered, security-checked playback. Most of the architectural risk in a self-hosted video project is retired at this point — what remains is largely operational hardening.

---

## Step 12: Move From Local Testing to Production

Local testing validates the architecture. Production requires a few additional decisions, none of which are unique to video infrastructure, but all of which matter more here because the failure modes are visible to end users as broken playback.

- **Storage**: move fully to S3-compatible object storage with proper lifecycle rules and backups — local disk should never hold production assets.
- **Scaling workers**: add more transcoding workers behind the queue as upload volume grows, rather than scaling one worker vertically.
- **Observability**: wire up centralized logging and monitoring for the API, workers, and queue so failures surface before customers notice. See the checklist below.
- **Secrets management**: move keys and credentials out of `.env` files and into a proper secrets manager.
- **Redundancy**: run more than one instance of each service, with backup and failover plans for your queue and database.
- **Deployment automation**: move from manual `docker compose up` runs to a repeatable CI/CD or infrastructure-as-code process.

None of this is unique to OllaNode — it's the same operational discipline any production infrastructure needs. The difference is that these decisions are yours to make, not a vendor's.

---

## Common Setup Mistakes to Avoid

- **Leaving storage on local disk past testing**: The single most common cause of "my videos disappeared" — it works fine right up until a container gets rebuilt.
- **Skipping webhook signature verification**: Trusting unsigned payloads opens your app to spoofed processing events, including a fake "ready" state.
- **Under-provisioning transcoding workers**: A queue that grows faster than it drains leaves users staring at stale "processing" states.
- **Serving playback directly from origin in production**: Defeats adaptive delivery and overloads your API and storage — usually a hardcoded origin URL that was never swapped for the CDN base URL.
- **Forgetting to rotate the default testing API key**: Treat every setup key as disposable before going live.
- **Mixing staging and production assets in one project**: Easy to avoid by creating separate projects up front; painful to clean up later.
- **Ignoring codec compatibility for your actual audience**: A ladder tuned for modern devices can produce a poor experience on older hardware if you haven't checked who's actually watching.

---

## Troubleshooting Reference

- **Uploads succeed but processing never starts**: Check that the job orchestrator is connected to the message stream (Step 3) and that at least one worker is healthy.
- **Assets fail validation immediately**: Confirm the source file's container and codec are supported. Re-mux locally with FFmpeg to rule out a nonstandard container.
- **Playback URL returns a 403**: Almost always signed-URL misconfiguration — either the signing secret used to generate the URL doesn't match the one the delivery service verifies against, or the token has expired.
- **Webhook events never arrive**: Verify your endpoint is publicly reachable from OllaNode's host, check for a firewall blocking outbound requests, and confirm the webhook URL was saved correctly in project settings.
- **Renditions are missing from the manifest**: Check worker logs for that asset ID — a partial rendition failure often still produces a manifest, just with fewer variants than expected.
- **Player loads the manifest but never plays**: Check that CORS is configured on the CDN if the player runs on a different domain from your CDN.

---

## Monitoring and Observability Checklist

Before calling a pipeline production-ready, confirm you have visibility into:

- **Queue depth** — jobs waiting versus processing, to catch a growing backlog before users notice.
- **Worker health** — CPU, memory, and error rate per worker, so a failing one is caught before it silently stops picking up jobs.
- **API error rates and latency**, especially on upload and asset-status endpoints.
- **Storage usage and growth rate**, to catch runaway costs or a misconfigured retention policy.
- **CDN cache hit ratio** — a low ratio usually means TTLs are too short or cache keys include something that should be ignored.
- **Webhook delivery success rate** — failures should be visible and retried, not silently dropped.

A minimum viable setup is centralized logging plus basic dashboards for each of these; a more mature setup adds alerting so a human is notified before a user complaint is.

---

## Security Hardening Checklist

Before opening a pipeline to real traffic, work through this list:

- Rotate every API key and signing secret generated during local testing.
- Confirm webhook signature verification actually rejects unsigned or mismatched requests, not just logs a warning.
- Enable signed playback URLs for any content that isn't fully public.
- Restrict database and storage credentials to the minimum permissions the services need, rather than broad admin credentials for convenience.
- Put the API behind a reverse proxy or gateway that enforces TLS.
- Set explicit CORS rules on your CDN and API rather than leaving them wide open.
- Store secrets in a secrets manager or encrypted config, not in your repository or plaintext deployment scripts.

None of this is exotic — it's the same baseline hygiene any production API needs. The reason to list it explicitly is that video pipelines have more moving parts than a typical CRUD API, making it easy to secure most of the system and overlook one piece, like webhook verification, that matters just as much as the rest.

---

## How to Scale Your Pipeline as Usage Grows

The pipeline you just built scales the same way most queue-based systems do: **horizontally**.

As upload volume grows, add more transcoding workers rather than making one worker larger. Because jobs are distributed through the message stream, additional workers pick up load automatically.

As viewing volume grows, lean on your CDN's cache hit ratio rather than scaling origin bandwidth directly — most delivery traffic should never reach origin storage once caching is tuned. Origin bandwidth climbing in proportion to viewer traffic usually signals a caching misconfiguration, not a capacity problem.

As your catalog grows, revisit storage tiering. Frequently watched content can stay on faster, pricier storage, while long-tail content moves to cheaper cold storage — introduce lifecycle rules that automate the transition rather than doing it manually.

This is also the point where GPU-accelerated transcoding becomes worth evaluating — CPU-only is fine for a first pipeline and moderate volume, but at real scale, GPU workers meaningfully reduce processing time and cost per minute encoded.

Finally, consider moving from Docker Compose to Kubernetes as team size grows, for finer-grained autoscaling of workers based on queue depth rather than manual capacity planning.

---

## Ollanode vs. Managed Video Platforms: When Self-Hosting Makes Sense

A fair question at this point is whether any of this is worth it compared to just calling a managed video API. There's no universally correct answer, but a few patterns are consistent across teams that have made this decision.

Self-hosting with OllaNode tends to make sense when your video volume is large enough that per-minute processing fees from a managed vendor exceed the engineering time to run your own pipeline, when you have data-residency or compliance requirements that rule out sending source video to a third party, or when you want configuration control a managed API doesn't expose. A managed provider tends to make more sense when volume is low and unpredictable, or when there's no existing platform capacity to run additional production services. Nothing about this decision is permanent — many teams run both side by side during a migration window.

---

## A Note on Costs at This Stage

A first pipeline built entirely on local infrastructure can cost close to nothing beyond the hardware or VM you are already running. The real costs — compute, storage, bandwidth, and engineering time — show up once you move to production and start processing and delivering meaningful volume.

That's a fair trade to understand going in: self-hosting with OllaNode replaces a per-minute vendor bill with infrastructure costs you configure and control, not with zero cost. Budget accordingly, and treat local setup as free architectural validation before spending anything meaningful. Compare infrastructure cost models on our [OllaNode Pricing Page](/pricing).

A simple way to frame it: your first working local pipeline tells you whether the architecture fits your product. Your production cost model is a separate exercise worth doing before scaling past a handful of test uploads.

---

## Who Should Follow This Guide

- Developers evaluating whether a self-hosted video pipeline fits their product before committing engineering time.
- Platform and infrastructure teams standing up video capability for the first time.
- Teams migrating off a managed provider who want a working reference pipeline first.
- Anyone who wants to understand, hands-on, what happens between "upload" and "playback ID."
- Engineers who inherited an existing pipeline and want a clear mental model before changing it.

---

## Frequently Asked Questions

### Do I need a GPU to set up my first Ollanode pipeline?
No. A CPU-only setup is enough to validate the full pipeline, from upload through adaptive HLS playback. GPU acceleration becomes worth evaluating once you are transcoding at production volume.

### How long does it take to set up a first working pipeline?
On a single machine with Docker Compose, most developers have a working end-to-end test — upload, transcode, HLS playback — running in under an hour.

### What storage backend should I use for testing?
Local disk is fine for initial testing. Move to S3-compatible object storage before handling any production traffic, since local disk does not survive container rebuilds and has no built-in redundancy.

### Does Ollanode support live streaming during setup?
Not currently. This guide covers video-on-demand pipeline setup. OllaNode does not currently provide RTMP ingest or live-streaming support.

### What manifest format does the pipeline produce?
HLS, packaged with CMAF/fMP4 segments. DASH is not currently a shipped manifest option, though the underlying packaging is designed to support it in the future.

### Do I need Kubernetes to run this?
No. Docker Compose is enough for local development and small production deployments. Kubernetes becomes more useful once you need automated scaling of transcoding workers across multiple nodes.

### Can I customize the resolution ladder for transcoding?
Yes, per project or per asset — useful when different content types in your catalog have different quality requirements.

### Is signed playback URL security required?
Not required, but strongly recommended for anything beyond fully public content. It adds a small amount of implementation work in exchange for expiring, per-viewer access control.

### What is the biggest mistake first-time setups make?
Leaving storage on local disk past the testing phase. It is the single most common cause of lost or inaccessible video after a pipeline has been running for a while.

### Is Ollanode open source?
Yes. It's distributed under the Apache-2.0 license, and the full source is available for inspection, self-hosting, and modification, written in Rust with FFmpeg handling the actual transcoding work.

---

## A Practical Validation Pass Before Production

Once the first end-to-end run succeeds, repeat the test with a second source file rather than treating one successful upload as proof that the pipeline is ready. Use a file with different resolution, audio characteristics, and duration. This catches assumptions that a single sample can hide, particularly around codec handling, rendition selection, transcript timing, thumbnail generation, and storage paths.

It is also worth testing failure paths deliberately. Upload an invalid file, temporarily make a dependency unavailable, send an invalid webhook signature, and try an expired playback URL. A production pipeline is defined not only by the happy path but by what it does when a stage fails. Record the expected state transition and the observable error for each test.

Finally, document the operational ownership of each layer. Someone should know who owns storage, who responds to queue growth, who investigates failed transcodes, who rotates signing secrets, and who checks CDN performance. Clear ownership turns a working technical demo into an operable system.

---

## Final Takeaway

Setting up your first open-source video pipeline is less about installing software and more about understanding the stages a video actually passes through: ingest, storage, orchestration, transcoding, packaging, delivery, and the security and observability layers wrapped around it.

Once that pipeline is running with OllaNode, every stage is something you can inspect, configure, and change — not a black box behind a vendor API. The steps here get you to a working local pipeline; the checklists get you to something you can put in front of real users with confidence.

The next step is yours: run it against a real catalog, watch how the queue, storage, and delivery layers behave under your workload, and tune from there rather than guessing in advance.

Explore the full platform and documentation at [OllaNode Docs](/docs) or view [OllaNode Features Overview](/#platform-capabilities).
