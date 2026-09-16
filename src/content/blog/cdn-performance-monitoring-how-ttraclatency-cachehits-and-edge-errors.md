---
title: 'CDN Performance Monitoring: How to Track Latency, Cache Hits, and Edge Errors'
seoTitle: 'CDN Performance Monitoring: How to Track Latency, Cache Hits & Edge Errors'
description: 'CDN performance monitoring guide to track latency (TTFB, p95/p99), edge cache hit ratios, and origin/edge error rates across video streaming pull zones with Ollanode.'
category: 'Video & CDN'
pubDate: 2026-09-11T12:00:00.000Z
author: 'The OllaNode Team'
tags: ['CDN', 'Video Delivery', 'Observability', 'Performance', 'Latency', 'Cache Hit Ratio', 'OpenResty', 'Edge Functions', 'Ollanode', 'Apache-2.0']
---

## CDN Performance Monitoring: The Observability Blind Spot at the Edge

A content delivery network is often treated as a binary utility: it is either routing traffic or it is completely offline. In production video streaming and high-concurrency API environments, binary health checks fail to capture the true operational state of your delivery layer. A CDN can report an aggregate 99.99% uptime while silently degrading viewer Quality of Experience (QoE). A 200ms latency creep on [dynamic HLS resolution ladders](/blog/how-to-generate-dynamic-hls-resolution-ladders) manifests triggers player stalls, an unmonitored origin shield collapse converts thousands of cached hits into an origin-saturating thundering herd, and intermittent 502 Bad Gateway responses at specific regional Points of Presence (POPs) go unnoticed because global averages mask regional anomalies.

Effective CDN performance monitoring requires measuring telemetry across three critical axes:

- **Edge Latency Distribution:** Deconstructing end-to-end response duration into its constituent network phases—DNS lookup, TCP handshake, TLS negotiation, Time to First Byte (TTFB), and Time to Last Byte (TTLB)—while analyzing high percentiles (p95, p99, p99.9) rather than misleading arithmetic means.
- **Cache Efficiency & Hit Ratios:** Distinguishing between Request Hit Ratio (RHR) and Byte Hit Ratio (BHR), monitoring cache state transitions (HIT, MISS, EXPIRED, UPDATING, BYPASS), and tracking segment-level revalidation patterns across HLS playlists (`.m3u8`) and media segments (`.m4s`/`.ts`).
- **Edge Error Signatures:** Categorizing HTTP status codes into operational failure domains, isolating edge-generated anomalies (such as TLS termination failures and Lua execution panics) from origin-generated errors (such as S3 rate limits, 504 gateway timeouts, and 403 token expiration events).

This technical guide demonstrates how to build, configure, and operate an end-to-end CDN observability stack for video delivery and static asset distribution. Using Ollanode—an open-source, self-hosted VOD and edge platform built on high-performance Rust and OpenResty—as our operational reference, we detail the metric definitions, log schemas, Prometheus exporters, alerting thresholds, and diagnostic runbooks required to achieve total visibility over your delivery infrastructure.

---

<div class="key-takeaways-box" id="key-takeaways">
  <div class="key-takeaways-header">
    <span class="key-takeaways-icon">✦</span>
    <h3 class="key-takeaways-title">KEY TAKEAWAYS</h3>
  </div>
  <ul class="key-takeaways-list">
    <li><strong>Arithmetic Means Hide Production Incidents:</strong> An average CDN latency of 45ms can easily mask a bimodal distribution where 90% of requests complete in 15ms while 10% stall for 3,000ms. Production monitoring must measure p90, p95, p99, and p99.9 percentiles.</li>
    <li><strong>Request Hit Ratio (RHR) Does Not Equal Byte Hit Ratio (BHR):</strong> An architecture serving 95% of its requests from cache can still drown its origin storage in bandwidth bills if the 5% cache misses happen to be 20MB 4K video segments while the 95% hits are 2KB manifest files.</li>
    <li><strong>Isolate Upstream Latency from Edge Latency:</strong> Always log <code>$upstream_response_time</code>, <code>$upstream_connect_time</code>, and <code>$request_time</code> independently in your reverse proxy access logs. Without this distinction, you cannot determine whether a slow request was caused by a sluggish client connection or an overloaded origin.</li>
    <li><strong>Cache-Control Headers Dictate Telemetry Patterns:</strong> Video manifests (<code>.m3u8</code>) and media segments (<code>.m4s</code>) require distinct cache invalidation rules. Manifests must leverage short TTLs with stale-while-revalidate, whereas media segments must be cached immutably with long TTLs.</li>
    <li><strong>Monitor the 499 Status Code:</strong> Nginx and OpenResty record an HTTP status of 499 when a client closes the connection before the server can complete the response. A surge in 499s is the earliest indicator that viewers are abandoning playback due to slow edge responses.</li>
    <li><strong>Trace Context Must Traverse the Edge:</strong> Propagate W3C traceparent headers through your edge [CDN pull zone configuration](https://ollanode.com/docs/cdn)s into upstream transcode and storage layers. Distributed tracing allows operators to correlate a specific video player stall with an upstream S3 disk bottleneck.</li>
    <li><strong>Ollanode Provides Unfettered Observability:</strong> Unlike black-box commercial CDNs that charge extra for real-time log streaming and aggregate metrics, a self-hosted platform like Ollanode exposes raw edge metrics, sub-second Prometheus scrapers, and line-level OpenResty access events by default.</li>
  </ul>
</div>

---

## Why CDN Performance Monitoring Matters for Video Delivery

When delivering video on demand (VOD), modern media architectures rely on edge pull zones to shield upstream storage systems—such as MinIO, Ceph, SeaweedFS, or AWS S3—from catastrophic request volume. Consider the physical mechanics of streaming an adaptive HLS video: a single 60-minute video encoded across five adaptive renditions (from 360p up to 4K) comprises one master playlist, five variant playlists, and over 1,800 discrete media segments (assuming standard 2-second fragment durations). When 50,000 concurrent viewers tune into a newly published asset, the delivery layer must serve 90 million discrete HTTP requests over the course of an hour.

Without dedicated CDN performance monitoring, failures in this delivery fabric remain completely invisible until end users flood support channels. Standard network monitoring tools (such as external ping checks or root HTTP status monitors) verify only that the web server process is accepting TCP connections. They cannot inform operators that:

- Video players in Western Europe are experiencing 450ms TTFB on playlist manifests due to TLS session ticket misconfigurations on local edge POPs.
- Cache invalidation routines triggered during a video re-transcode failed to purge variant manifests, causing players to download manifests referencing non-existent segment chunks, manifesting as sudden bursts of HTTP 404 errors.
- Unsanitized authentication tokens appended to video segment query strings are bypassing the edge cache entirely, converting 100% of segment requests into direct origin storage fetches, pushing origin IOPS to hardware saturation.
- Client aborts (HTTP 499) are surging on high-bitrate 1080p and 4K streams because the edge proxy's send buffer settings are throttling throughput below the video encoding bitrate, forcing playback buffers to empty and video players to stall.

Observability is not an operational afterthought; it is an active feedback loop. By instrumenting high-precision metrics at the edge layer, platform engineers can automatically detect localized transit peering failures, identify degraded storage pools before they trigger cascading timeouts, and dynamically tune caching parameters to maximize hit ratios.

For a deeper look at the architecture behind open-source video delivery, see our guide to open-source video infrastructure.

---

## CDN Performance Monitoring Metrics: Latency, Cache Efficiency, and Errors

Building a robust CDN observability platform requires establishing rigorous mathematical and technical definitions for every metric captured. In high-throughput edge environments, telemetry is divided into three functional pillars: Latency, Cache Efficiency, and Error Signatures.

The timing boundaries within a single edge reverse proxy transaction fall into distinct network and compute stages:

1. **Client Connection Setup:** Client-to-edge DNS resolution, TCP three-way handshake (SYN, SYN-ACK, ACK), and TLS cryptographic negotiation.
2. **Edge Header Reception:** The edge proxy reads and validates the incoming HTTP request headers.
3. **Local Routing & Authentication:** In-memory execution of Lua routing hooks, authorization tokens, or cookie exchanges.
4. **Cache Key Evaluation:** Hashing the request parameters against the in-memory cache metadata dictionary (`keys_zone`).
5. **Cache Hit Path:** Direct streaming of the cached payload from local NVMe storage or page cache into the client socket buffer.
6. **Cache Miss / Upstream Fetch:** Establishing upstream connections (`$upstream_connect_time`), transmitting proxied headers, awaiting upstream header generation (`$upstream_header_time`), and spooling data from storage or shield nodes (`$upstream_response_time`).
7. **Client Body Transfer:** Pushing the complete payload to the downstream client socket, finalized when the client confirms receipt of the final byte (`$request_time`).

---

## Edge Latency Deconstructed: From Socket Connection to Byte Delivery

When a media player issues an HTTP GET request for a segment such as `seg_1080p_0042.m4s`, the total elapsed duration observed by the client is composed of several discrete network and compute phases. To debug latency anomalies, the edge proxy must capture and expose each boundary:

### 1. Connection Latency (TCP & TLS)

Before an HTTP request can be transmitted, the client must establish a secure transport session. In high-performance video architectures, this phase must be aggressively optimized:

- **TCP Handshake Time:** The time required to complete the SYN -> SYN-ACK -> ACK round-trip. This is heavily dependent on physical geographic distance to the edge POP. An Anycast network or GeoDNS setup should maintain client-to-POP round-trip times below 25ms.
- **TLS Negotiation Time:** The duration required to exchange cryptographic keys, validate certificate chains, and negotiate cipher suites. Under TLS 1.3, this requires a single round-trip (1-RTT), or zero round-trips (0-RTT) during session resumption. If TLS negotiation exceeds 50ms, it typically points to missing OCSP stapling, oversized certificate chains, or disabled session tickets.

### 2. Time to First Byte (TTFB)

TTFB is defined as the elapsed time from the moment the edge reverse proxy receives the final byte of the client's HTTP request headers to the moment the edge server writes the first byte of the response headers back into the client socket buffer.

In OpenResty and Nginx environments, TTFB is governed by cache state:

- **Cache Hit TTFB:** The time required for the edge process to parse request headers, execute routing and authentication Lua hooks, hash the cache key, retrieve the object header from the in-memory cache metadata index (`keys_zone`), and open the file descriptor on local NVMe storage. On tuned Ollanode edge nodes, Cache Hit TTFB should never exceed 15ms at p95.
- **Cache Miss TTFB:** The time required to resolve the upstream origin (via DNS or connection pool), establish the upstream TCP/TLS connection, transmit the proxied request, wait for the origin storage or transcoder to generate the response headers, and begin relaying bytes. Cache Miss TTFB should remain below 180ms at p95.

### 3. Time to Last Byte (TTLB) and Request Time

TTLB encompasses the entire duration required to transfer the complete response body to the client. In OpenResty, this is recorded in the core variable `$request_time`, which measures the time elapsed from the first incoming bytes read from the client until the last bytes are successfully pushed to the client socket buffers.

Monitoring the difference between `$request_time` and `$upstream_response_time` provides immediate visibility into client connection quality:

```text
Client Transfer Overhead = $request_time - $upstream_response_time
```

If `$request_time` is 4,500ms while `$upstream_response_time` is only 42ms, the delay is entirely attributable to downstream client throughput limitations (such as a mobile device traversing a cellular dead zone) or an undersized TCP send buffer on the edge proxy.

---

## Cache Hit Ratio Mechanics: Tracking RHR, BHR, and Invalidation Cascades

A high cache hit ratio is the ultimate measure of CDN health. However, treating cache efficiency as a single unified metric leads to dangerous operational assumptions. Production observability mandates tracking two complementary hit ratio formulas:

### 1. Request Hit Ratio (RHR)

Request Hit Ratio measures the raw percentage of inbound HTTP transactions satisfied by the edge cache without querying the origin:

```text
RHR = ((Requests_HIT + Requests_REVALIDATED) / Requests_TOTAL) * 100
```

Where:
- **Requests_HIT:** Responses served directly from valid, unexpired edge storage.
- **Requests_REVALIDATED:** Responses where the edge held an expired asset, issued an `If-None-Match` or `If-Modified-Since` request to the origin, and received an HTTP 304 Not Modified, allowing the edge to refresh the asset without re-downloading the body.
- **Requests_TOTAL:** All eligible caching requests received at the edge.

### 2. Byte Hit Ratio (BHR)

Byte Hit Ratio measures the proportion of total outbound network traffic served directly from edge cache storage versus the data transferred from upstream origins:

```text
BHR = (Bytes_EGRESS_FROM_CACHE / Bytes_TOTAL_EGRESS) * 100
```

In video streaming platforms, BHR is the critical driver of infrastructure cost reduction. Consider this real-world operational scenario:

| Asset Type | Hourly Requests | Size per Object | Total Egress Volume | Cache Status |
| :--- | :--- | :--- | :--- | :--- |
| Master Manifest (`master.m3u8`) | 50,000 | 1.2 KB | 60 MB | HIT (from cache) |
| Variant Manifests (`1080p.m3u8`) | 150,000 | 4.8 KB | 720 MB | HIT (from cache) |
| Video Segments (`seg_042.m4s`) | 10,000 | 18.5 MB | 185 GB | MISS (from origin) |

Calculating the metrics for this distribution:
- **Total Requests:** `50,000 + 150,000 + 10,000 = 210,000`
- **Request Hit Ratio (RHR):** `(200,000 / 210,000) * 100 = 95.23%`
- **Total Egress Bandwidth:** `0.06 GB + 0.72 GB + 185 GB = 185.78 GB`
- **Cached Egress Bandwidth:** `0.78 GB`
- **Byte Hit Ratio (BHR):** `(0.78 / 185.78) * 100 = 0.42%`

Despite an apparently healthy Request Hit Ratio of 95.23%, the Byte Hit Ratio is essentially zero (0.42%). The origin storage infrastructure is transferring 185 GB of raw video chunks every hour, resulting in unbudgeted egress billing and storage IOPS exhaustion. Monitoring both RHR and BHR independently exposes these caching failures instantly.

### 3. Granular Edge Cache States

Modern edge proxies do not operate in a simple binary hit/miss state. In OpenResty and Ollanode, the `$upstream_cache_status` variable records one of seven distinct operational states:

- **HIT:** The asset was served directly from edge cache memory or local NVMe storage. Zero upstream origin traffic was generated.
- **MISS:** The asset was not found in the cache. The edge proxy fetched the full object from the upstream origin, wrote it to local cache storage, and relayed it to the client.
- **EXPIRED:** The cached object exceeded its configured max-age or `proxy_cache_valid` duration. The edge proxy issued a conditional request to the origin.
- **UPDATING:** The cached object was expired, but `proxy_cache_use_stale updating` was enabled. The edge proxy served the stale object to the client immediately while launching an asynchronous background subrequest to fetch the fresh asset from the origin.
- **STALE:** The origin was unreachable, timed out, or returned a 5xx error, but `proxy_cache_use_stale error timeout http_502` was configured, allowing the edge proxy to serve the expired cached copy rather than returning an error to the user.
- **BYPASS:** The cache was intentionally skipped due to a matching `proxy_cache_bypass` directive (such as an administrative bypass cookie or request header).
- **REVALIDATED:** The cached object was expired, but the upstream origin responded with HTTP 304 Not Modified. The local cache TTL was extended without transferring the response body.

---

## Edge Error Taxonomy: Diagnosing 4xx, 5xx, and Silent Drops

In distributed video delivery, errors must be classified by origin and type. A sudden surge in HTTP errors requires distinguishing between client misbehavior, edge proxy failure, and upstream origin collapse.

### Client-Side vs. Delivery Anomalies (4xx)

- **HTTP 400 Bad Request:** Malformed client requests, corrupted headers, or oversized HTTP cookie payloads. Spikes typically correlate with client-side player SDK bugs.
- **HTTP 403 Forbidden:** Occurs when signed playback tokens fail validation. In Ollanode, HMAC-SHA256 tokens are validated at the edge using Lua. Spikes in 403s indicate token expiration clock drift between the application server and the edge POP, or an aggressive token expiration TTL that expires before a user finishes watching a video.
- **HTTP 404 Not Found:** In VOD delivery, 404 errors on media segments are critical indicators of manifest-to-storage synchronization failures. If an adaptive bitrate manifest is published before all constituent video chunks have finished uploading to S3 storage, players following the manifest will request non-existent segments, causing playback crashes.
- **HTTP 416 Range Not Satisfiable:** Occurs when a client requests a byte offset outside the file boundary. This frequently indicates an incomplete upload or a corrupted MP4 header during progressive fallback delivery.
- **HTTP 499 Client Closed Request:** A proprietary Nginx/OpenResty status code generated when the client terminates the TCP socket while the proxy is still processing or waiting for the upstream response. A high 499 rate is the primary server-side proxy metric for video playback stalls.

### Edge vs. Upstream Server Failures (5xx)

- **HTTP 500 Internal Server Error:** Typically generated directly by the edge proxy when internal Lua execution panics, memory limits are exceeded, or file permissions on the local NVMe cache directory prevent read/write operations.
- **HTTP 502 Bad Gateway:** The edge proxy connected to the upstream origin, but the origin closed the connection unexpectedly, threw an invalid HTTP header, or crashed during processing.
- **HTTP 503 Service Unavailable:** The upstream origin is experiencing concurrency saturation, rate limiting (such as S3 SlowDown responses), or local worker thread exhaustion.
- **HTTP 504 Gateway Timeout:** The edge proxy successfully established a TCP socket to the upstream origin, but the origin failed to transmit an HTTP response header within the configured `proxy_read_timeout` window (typically 5 to 10 seconds). This indicates stalled transcode workers or deadlocked storage controllers.

---

## The Ollanode Delivery Plane Observability Model

To understand how to monitor CDN performance in a modern architecture, we must analyze the delivery plane of Ollanode. Ollanode decouples the synchronous API control plane (written in high-speed Rust) from the high-throughput delivery edge (powered by OpenResty and native Lua modules).

In the Ollanode delivery architecture:

- **Edge Pull Zones:** Distributed OpenResty instances execute localized token authentication, maintain multi-tier caching structures (in-memory zone indexes paired with high-IOPS NVMe storage pools), and expose Prometheus metrics endpoints.
- **Origin Shielding:** An intermediate caching tier that sits between edge POPs and the raw storage layer. When an uncached 4K video segment is requested across 40 worldwide edge nodes simultaneously, the edge nodes pull from the Origin Shield. The Shield executes request collapsing (`proxy_cache_use_stale updating`), issuing exactly one request to the underlying storage bucket, eliminating the thundering herd problem.
- **Telemetry Pipeline:** Every request emits a structured, high-precision JSON event containing upstream connection timings, cache flags, byte sizes, and W3C trace IDs. A local Vector agent aggregates these logs, updates real-time Prometheus gauges, and streams structured logs to long-term storage.

If you are building the complete delivery stack, see our step-by-step guide to setting up an open-source video pipeline, including adaptive HLS delivery and CDN configuration.

---

## Step-by-Step Implementation: Building the Edge Monitoring Stack

### Step 1: Instrument High-Precision JSON Access Logs in OpenResty

**Description:** Replaces default Nginx logs with structured JSON. Capturing `$request_time` alongside `$upstream_response_time` and `$upstream_connect_time` allows you to immediately distinguish between slow client networks and slow storage origins.

```nginx
# /etc/openresty/conf.d/logging.conf
log_format cdn_telemetry_json escape=json {
  "timestamp": "$time_iso8601",
  "client_ip": "$remote_addr",
  "trace_id": "$http_traceparent",
  "pop_id": "us-east-edge-01",
  "uri": "$uri",
  "status": $status,
  "request_time": $request_time,
  "upstream_cache_status": "$upstream_cache_status",
  "upstream_response_time": "$upstream_response_time",
  "upstream_connect_time": "$upstream_connect_time"
};

access_log /var/log/openresty/cdn_access.json cdn_telemetry_json buffer=64k flush=1s;
```

### Step 2: Export Real-Time Edge Metrics via In-Memory Lua

**Description:** Instead of waiting for logs to ship, OpenResty calculates request counters, byte volumes, and latency histograms directly in shared memory (`lua_shared_dict`), exposing a sub-second Prometheus scrape endpoint.

```nginx
# /etc/openresty/conf.d/metrics.conf
lua_shared_dict prometheus_metrics 20M;

init_worker_by_lua_block {
    local prometheus = require("resty.prometheus")
    p_exporter = prometheus.init("prometheus_metrics")
    
    metric_requests = p_exporter:counter("cdn_requests_total", "Total requests", {"status", "cache_status"})
    metric_latency = p_exporter:histogram("cdn_request_duration_seconds", "Request latency", 
        {"cache_status"}, {0.01, 0.035, 0.075, 0.15, 0.5, 1.0, 2.5})
}

log_by_lua_block {
    metric_requests:inc(1, {ngx.var.status, ngx.var.upstream_cache_status or "NONE"})
    metric_latency:observe(tonumber(ngx.var.request_time) or 0, {ngx.var.upstream_cache_status or "NONE"})
}

server {
    listen 127.0.0.1:9145;
    location /metrics { content_by_lua_block { p_exporter:collect() } }
}
```

### Step 3: Deploy Vector for Log Parsing and Aggregation

**Description:** Vector tails the local JSON log stream on the edge node, normalizes latency into milliseconds, extracts video asset IDs using regular expressions, and batch-ships events to your analytics store (ClickHouse/Elasticsearch).

```toml
# /etc/vector/vector.toml
[sources.cdn_logs]
type = "file"
include = ["/var/log/openresty/cdn_access.json"]

[transforms.parse_logs]
type = "remap"
inputs = ["cdn_logs"]
source = '''
  . = parse_json!(.message)
  .request_time_ms = to_float!(.request_time) * 1000.0
  if match(.uri, r'^\/assets\/(?P<id>[a-zA-Z0-9_\-]+)\/') {
      matched = parse_regex!(.uri, r'^\/assets\/(?P<id>[a-zA-Z0-9_\-]+)\/(?P<file>.*)$')
      .asset_id = matched.id
      .media_file = matched.file
  }
'''

[sinks.clickhouse]
type = "elasticsearch"
inputs = ["parse_logs"]
endpoints = ["https://logs.internal.ollanode.com:9200"]
index = "cdn-access-%Y.%m.%d"
```

### Step 4: Propagate W3C Distributed Tracing

**Description:** Guarantees end-to-end request tracing. If a client doesn't send a W3C trace header, OpenResty generates one, attaches it to the upstream request, and sends it back to the client as `X-Ollanode-Trace`.

```nginx
# /etc/openresty/conf.d/tracing.conf
set_by_lua_block $propagated_traceparent {
    local trace = ngx.req.get_headers()["traceparent"]
    if trace and #trace == 55 then return trace end
    
    local str = require("resty.string")
    local rand = require("resty.random")
    local trace_id = str.to_hex(rand.bytes(16))
    local parent_id = str.to_hex(rand.bytes(8))
    return string.format("00-%s-%s-01", trace_id, parent_id)
}

proxy_set_header traceparent $propagated_traceparent;
add_header X-Ollanode-Trace $propagated_traceparent always;
```

### Step 5: Configure Production Alerting Rules in Prometheus

**Description:** Alerts must target high percentiles (p95/p99) and rate collapses rather than averages. This Alertmanager configuration catches degraded POP latency, origin slowdowns, and client buffering cascades.

```yaml
# /etc/prometheus/rules/cdn_alerts.yml
groups:
  - name: CDN_Performance_Alerts
    rules:
      # Alert when cached TTFB is slow
      - alert: CDNCacheHitLatencyDegraded
        expr: histogram_quantile(0.95, sum(rate(cdn_request_duration_seconds_bucket{cache_status="HIT"}[5m])) by (le)) > 0.045
        for: 3m
        annotations:
          summary: "p95 cache hit latency exceeds 45ms"

      # Alert when cache hit ratio collapses
      - alert: CDNCacheHitRatioCollapse
        expr: (sum(rate(cdn_requests_total{cache_status=~"HIT|REVALIDATED"}[5m])) / sum(rate(cdn_requests_total[5m]))) < 0.85
        for: 5m
        annotations:
          summary: "CDN Request Hit Ratio dropped below 85%"

      # Alert on client video buffering (HTTP 499 client aborts)
      - alert: CDNClientAbortSurge
        expr: (sum(rate(cdn_requests_total{status="499"}[5m])) / sum(rate(cdn_requests_total[5m]))) > 0.02
        for: 3m
        annotations:
          summary: "Client aborts (HTTP 499) exceed 2% - indicates video stalls"
```

### Step 6: Correlate Edge Metrics with Player QoE Beacons

**Description:** Edge servers can return HTTP 200 while users experience playback freezes. Web and mobile video players emit periodic Quality of Experience (QoE) beacons linking client playback health to the edge trace ID.

```javascript
// Video Player Beacon Hook (HLS.js / Video.js)
const qoeBeacon = {
  asset_id: "vid_prod_7781a",
  session_id: "sess_98234812a",
  ttff_ms: Math.round(performance.getEntriesByName("first-frame")[0]?.startTime || 0),
  rebuffer_ratio: (totalBufferStallSeconds / totalWatchSeconds),
  // Extract trace ID injected by Step 4 from the last segment response header
  last_segment_trace_id: lastSegmentResponse.headers.get("X-Ollanode-Trace")
};

// Send beacon asynchronously without blocking playback
navigator.sendBeacon("https://telemetry.ollanode.com/api/v1/telemetry/qoe", JSON.stringify(qoeBeacon));
```

---

## Real-World Failure Modes and Diagnostic Runbook

When an edge alert fires, use this rapid diagnostic guide to isolate and resolve the 4 most common CDN failure modes:

### Scenario 1: Cache Hit Ratio Drops (96% to 40% - Origin Overload)

- **Symptoms:** Origin bandwidth spikes 15x; origin storage CPU hits 100%.
- **Root Cause:** Query-string pollution (random timestamps or tracking tags like `?_t=...` or `?v=...`) busting the cache key.
- **Quick Diagnosis:**
  ```bash
  tail -n 5000 /var/log/openresty/cdn_access.json | jq -r '.uri + "?" + .query_string' | sort | uniq -c | head -n 10
  ```
- **Immediate Fix:** Normalize the cache key in OpenResty to strip non-security query parameters:
  ```nginx
  proxy_cache_key "$scheme$request_method$host$uri$clean_args";
  ```
  Reload config:
  ```bash
  openresty -s reload
  ```

### Scenario 2: Surge in HTTP 499 (Client Connection Aborts)

- **Symptoms:** Video playback stalls on 1080p/4K; players abort connections after buffer starvation.
- **Root Cause:** Edge TCP output buffers saturating under high-bitrate streaming loads.
- **Quick Diagnosis:**
  ```bash
  grep '"status": 499' /var/log/openresty/cdn_access.json | jq -r '.uri' | awk -F'/' '{print $NF}' | sort | uniq -c
  ```
- **Immediate Fix:** Scale TCP memory buffers and enable BBR congestion control in `/etc/sysctl.conf`:
  ```ini
  net.core.wmem_max = 16777216
  net.ipv4.tcp_wmem = 4096 65536 16777216
  net.ipv4.tcp_congestion_control = bbr
  ```
  Apply instantly:
  ```bash
  sysctl -p
  ```

### Scenario 3: Origin Shield Collapse (Thundering Herd)

- **Symptoms:** Upstream storage returns HTTP 503 SlowDown or 504 Gateway Timeout on newly released content.
- **Root Cause:** `proxy_cache_lock` is off, triggering thousands of concurrent origin requests for the same uncached segment.
- **Quick Diagnosis:**
  ```bash
  grep -rn "proxy_cache_lock" /etc/openresty/
  ```
- **Immediate Fix:** Enable request collapsing and stale-while-revalidate locks:
  ```nginx
  proxy_cache_lock on;
  proxy_cache_lock_timeout 5s;
  proxy_cache_use_stale updating error timeout;
  ```
  Reload config:
  ```bash
  openresty -s reload
  ```

### Scenario 4: Manifest 404 Cascades on New Uploads

- **Symptoms:** Master playlist loads (200 OK), but video chunks fail with 404 Not Found.
- **Root Cause:** Manifest was published before segment packaging finished, and the edge cached the 404 responses.
- **Quick Diagnosis:**
  ```bash
  curl -I https://storage-origin.internal.ollanode.com/assets/<asset_id>/1080p_0001.m4s
  ```
- **Immediate Fix:** Enforce short 2-second negative caching for 404s and trigger a selective edge purge:
  ```nginx
  proxy_cache_valid 404 2s;
  ```
  Purge via API:
  ```bash
  curl -X POST https://api.ollanode.com/v1/cdn/purge \
    -H "Authorization: Bearer $OLLANODE_API_KEY" \
    -H "Content-Type: application/json" \
    -d '{"zone_id": "pull-zone-vod-01", "purge_pattern": "/assets/<asset_id>/*"}'
  ```

---

## Common CDN Monitoring Anti-Patterns to Avoid

When implementing delivery monitoring, engineering teams frequently introduce architectural flaws that compromise telemetry accuracy or create severe performance penalties:

1. **Evaluating Delivery Quality via Arithmetic Means:** Averaging latency across millions of requests hides catastrophic tail failures. If 98% of viewers experience a lightning-fast 20ms TTFB, but 2% encounter a 4,000ms delay, the mathematical average will report an acceptable 99.6ms. However, that 2% tail represents thousands of paying users experiencing unplayable video. Always track p95, p99, and p99.9 percentiles.
2. **Attaching High-Cardinality Labels to Prometheus Metrics:** Prometheus time-series memory consumption scales linearly with the product of all label dimensions. Never attach individual `client_ip`, `user_id`, or specific `session_id` tags to Prometheus counters or histograms. Doing so creates millions of active metric streams, triggering Prometheus out-of-memory (OOM) crashes. Reserve high-cardinality values for structured access logs (processed via Vector or ClickHouse), and keep Prometheus labels constrained to low-cardinality operational dimensions (`pop`, `zone`, `status_code_class`, `cache_status`).
3. **Conflating Cache Misses with Cache Bypasses:** A `MISS` means the requested object was cacheable, but not present in local storage. A `BYPASS` means the proxy was explicitly instructed not to evaluate or store the object. Mixing these two states corrupts cache efficiency analysis and blinds operators to unintentional bypass triggers (such as unexpected Authorization or Set-Cookie headers).
4. **Overlooking Origin Shield Metrics:** Monitoring only edge POPs while neglecting intermediate Origin Shields creates a dangerous blind spot. If an Origin Shield's cache fills up or its worker processes hang, the shield stops consolidating traffic, silently passing the full thundering herd downstream to primary object storage.
5. **Neglecting Negative Caching Rules:** When an upstream storage system temporarily hiccups and returns an error (such as a 503 or transient 404), an edge proxy lacking explicit negative caching rules will either slam the failing origin repeatedly with every incoming request, or cache the 404/500 error for the default TTL (e.g., 24 hours), locking users into broken playback long after the origin has recovered.

---

## Self-Hosted Edge Observability (Ollanode) vs. Black-Box Commercial CDNs

Organizations operating at scale must evaluate the operational control of self-hosted edge delivery against the managed simplicity of commercial CDN vendors.

| Capability / Operational Surface | Ollanode Self-Hosted Edge Platform | Black-Box Commercial CDNs (Cloudflare / Fastly / CloudFront) |
| :--- | :--- | :--- |
| **Log Delivery Latency** | Sub-second local socket streaming via Vector | Batch log delivery with 30-second to 15-minute ingestion lag |
| **Telemetry Granularity** | Full access to raw OpenResty variables | Constrained to vendor-sanitized fields and restricted schema definitions |
| **Real-Time Metric Resolution** | 1-second scrape intervals via native Prometheus exporter | Coarse 1-minute to 5-minute sampling intervals; sub-minute metrics require premium tiers |
| **Log Ingestion & Egress Costs** | Zero additional cost; run on your own hardware or VPC | Punitive per-million log line fees or high-rate enterprise add-on contracts |
| **Custom Lua / Edge Hook Telemetry** | Native arbitrary Lua execution with in-memory histogram tracking | Restricted sandboxed workers with execution time and CPU limits |
| **Origin Shield Observability** | Complete visibility into shield CPU, NVMe IOPS, and consolidation ratio | Shielding mechanics are completely opaque |
| **Data Sovereignty & Compliance** | 100% data residency; zero client IP or PII leakage to third parties | Client metadata traverses [multi-tenant infrastructure](/blog/multi-tenant-self-hosted-video-platform-isolation-quotas-access-control-and-billing) global third-party infrastructure |
| **Dynamic HLS Cache Optimization** | Built-in source-aware HLS caching rules tuned for adaptive streaming | Generic HTTP caching; requires manual maintenance of complex rule engines |

For engineering teams where video streaming and API delivery represent core operational competencies, the unfettered transparency of Ollanode transforms troubleshooting from guessing into an exact, instrumented engineering discipline.

---

## Production CDN Observability Readiness Checklist

Before approving a new edge delivery cluster or pull zone configuration for production traffic, verify that your monitoring implementation satisfies every requirement on this operational checklist:

- [x] **Dual-Metric Cache Accounting:** Prometheus dashboards independently calculate and display both Request Hit Ratio (RHR) and Byte Hit Ratio (BHR).
- [x] **High-Precision Access Logging:** OpenResty emits structured JSON logs including `$request_time`, `$upstream_response_time`, `$upstream_connect_time`, and `$ssl_handshake_time`.
- [x] **Sub-Second Metric Export:** A native in-memory Lua exporter serves real-time histograms and counters to Prometheus on an isolated management port.
- [x] **W3C Traceparent Propagation:** The edge proxy extracts or generates traceparent headers and forwards them across upstream storage and origin layers.
- [x] **Granular Status Code Partitioning:** Telemetry classifies errors into edge-generated vs. origin-generated categories, with dedicated tracking for client aborts (HTTP 499).
- [x] **Adaptive Caching Rules:** Manifest files (`.m3u8`) are configured with short TTLs and stale-while-revalidate, while media segments (`.m4s`/`.ts`) are cached immutably with long TTLs.
- [x] **Thundering Herd Protection:** `proxy_cache_lock` and `proxy_cache_use_stale` are active on all edge pull zones and intermediate origin shields.
- [x] **Negative Caching Configured:** Transient errors (404, 502, 503) are assigned short, explicit negative cache durations (e.g., 2 to 5 seconds).
- [x] **Percentile-Based Alerting:** Alertmanager triggers on p95 and p99 latency thresholds rather than arithmetic averages.
- [x] **Player-Side QoE Correlation:** A client-side beacon pipeline ingests TTFF and Rebuffer Ratio metrics, linking client playback sessions with server-side trace IDs.
- [x] **Zero High-Cardinality Metric Leakage:** Metric labels are strictly bounded to low-cardinality operational dimensions.

---

## Frequently Asked Questions

### Q1. What is the ideal edge cache hit ratio for adaptive HLS video streaming?

In a properly tuned video streaming architecture, media segments (`.m4s` or `.ts` chunks) should achieve a Byte Hit Ratio (BHR) between 96% and 99%. Because video segments are immutable and addressable by unique filenames, they should remain in edge cache for weeks or months. Adaptive playlist manifests (`.m3u8`), which must be refreshed periodically during updates, typically achieve a Request Hit Ratio (RHR) between 85% and 92%. Any aggregate Byte Hit Ratio falling below 90% indicates severe cache thrashing or premature object eviction.

### Q2. Why is Time to First Byte (TTFB) more critical for video delivery than raw bandwidth?

While high download bandwidth is necessary to prevent playback buffering, edge TTFB determines the player's initial startup speed (Time to First Frame) and the latency of mid-stream adaptive bitrate switches. When a video player decides to switch from 720p to 1080p, it must fetch the new variant manifest and the next segment chunk. If edge TTFB is slow (e.g., > 300ms), the player's forward buffer may run dry before the new rendition chunk arrives, triggering a playback freeze. Low TTFB ensures instantaneous rendition switching and rapid startup.

### Q3. How do I track down the cause of intermittent HTTP 502 Bad Gateway errors at the edge?

An HTTP 502 means the edge proxy successfully established a socket to the upstream server, but the upstream terminated the connection abnormally or returned an invalid HTTP response. To diagnose:
1. Inspect the `$upstream_status` and `$upstream_addr` fields in your edge JSON access logs to pinpoint the exact origin node failing.
2. Check upstream operating system kernel logs (`dmesg`) for process crashes or out-of-memory (OOM) evictions.
3. Verify connection keep-alive settings between the edge and origin. If the upstream server's `keepalive_timeout` is shorter than the edge proxy's idle pool timeout, the upstream may close the socket just as the edge dispatches a request, generating intermittent 502s.

### Q4. What causes a high rate of HTTP 499 errors in CDN access logs?

HTTP 499 is generated when the client terminates the TCP connection before the server finishes sending the response. In video delivery, a surge in 499s almost always points to player stalls: the video player's internal buffer ran out of media, the player timed out waiting for the edge server to respond, aborted the download, and attempted to fetch the segment from an alternate CDN or lower bitrate rung. Tracking 499s provides early warning of delivery latency spikes before users file complaints.

### Q5. Should query string parameters be included in the CDN cache key for video?

In general, no. In video streaming, including unvalidated query string parameters in the cache key destroys cache efficiency because marketing tracking tags, user session IDs, or random cache-busting tokens will cause identical video files to be cached repeatedly under different keys. The only exception is cryptographic access tokens (such as HMAC tokens). In Ollanode, authentication tokens are validated at the edge using Lua, and the query string is stripped from the internal `proxy_cache_key`, ensuring pristine cache deduplication.

### Q6. How does Origin Shielding improve CDN monitoring and performance?

Origin Shielding places a centralized, high-capacity caching layer between distributed regional edge POPs and your primary storage infrastructure. Without shielding, 50 regional POPs experiencing a concurrent cache miss for the same asset will generate 50 parallel requests to the origin. With Origin Shielding, the 50 edge POPs query the shield, which collapses the requests and fetches the asset from the origin exactly once. Monitoring the shield's hit ratio and request consolidation ratio demonstrates how effectively your storage layer is protected from traffic surges.

### Q7. What is the difference between active synthetic monitoring and passive telemetry?

Passive telemetry analyzes real user requests captured in edge access logs and Prometheus metrics. It reflects authentic user experiences but cannot detect failures in regions or paths where no users are currently active. Active synthetic monitoring uses automated probes deployed worldwide to issue test HTTP requests for manifests and segments on a fixed schedule (e.g., every 60 seconds). Synthetic monitoring detects regional routing outages, DNS resolution failures, and SSL certificate expirations before actual users are impacted.

### Q8. How do I monitor CDN performance if I use multiple CDN providers (Multi-CDN)?

In a Multi-CDN topology, a client-side routing broker or DNS steering service (such as GeoDNS or Anycast) dynamically assigns viewers to the optimal CDN provider based on real-time performance. To monitor effectively:
- Embed a common session identifier (`session_id`) across all providers.
- Standardize log fields and metric formats across all CDN endpoints.
- Rely heavily on client-side player QoE beacons (TTFF, Rebuffer Ratio) to evaluate providers objectively under identical network conditions.

---

## Conclusion and Actionable Takeaways

Modern web and video architectures cannot operate reliably with black-box delivery networks. Treating the edge as an unmonitored utility invites undetected latency degradation, silent cache invalidation failures, and unbudgeted origin bandwidth expenses.

For the API side of the video lifecycle, see our guide to the self-hosted [self-hosted video API](/blog/sel-hosted-video-api-upload-processing-playback-webhooks-ans-asset-lifecycles) covering upload, processing, playback, webhooks, and asset lifecycle management.

By instrumenting high-precision JSON access logging, computing real-time metrics via native in-memory Lua exporters, enforcing thundering-herd protections, and correlating edge latency percentiles with client-side player QoE telemetry, you transform edge delivery into an observable, predictable system.

### Immediate Action Items:
- **Audit Your Access Logs:** Transition your edge logging configuration from standard combined formats to high-precision JSON capturing `$request_time`, `$upstream_response_time`, and `$upstream_cache_status`.
- **Implement Dual Hit Ratio Tracking:** Configure your monitoring dashboards to display both Request Hit Ratio (RHR) and Byte Hit Ratio (BHR) side-by-side to expose large-file caching failures.
- **Switch to Percentile Alerting:** Eliminate alerts based on arithmetic mean latencies; deploy Prometheus alerts targeting p95 and p99 thresholds on cache hit TTFB and upstream response times.
- **Deploy OllaNode Video Infrastructure for Total Visibility:** Explore Ollanode to implement an open-source, self-hosted video and edge platform that delivers full data sovereignty, zero per-minute billing, and complete, line-level delivery observability.

---
