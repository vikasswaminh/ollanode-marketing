---
title: 'Model Context Protocol (MCP) in Action: Controlling Video Infrastructure with AI Agents'
description: 'An implementation-focused guide to using the Model Context Protocol (MCP) to let AI agents inspect, reason about, and control video infrastructure with Ollanode.'
category: 'AI & Agents'
pubDate: 2026-08-27
author: 'The OllaNode Team'
tags: ['AI & Agents', 'MCP', 'ModelContextProtocol', 'AIAgents', 'AIInfrastructure', 'VideoInfrastructure', 'AgenticAI', 'Ollanode', 'HLS', 'VideoProcessing', 'SelfHosted']
---

AI agents are good at deciding what should happen next. Your infrastructure is good at actually doing it.

The awkward part has always been the space between those two things.

An AI assistant can understand a request such as:  
*"Find the videos that failed processing today, tell me why, and retry the ones that are safe to retry."*

But understanding the request is only half the job. The agent needs a reliable way to discover what operations are available, inspect the current state of your infrastructure, provide the right parameters, authenticate correctly, and execute the requested action without accidentally turning a routine task into a production incident.

That's where Model Context Protocol (MCP) becomes interesting.

MCP is an open protocol for connecting AI applications to the tools, resources, and prompts provided by external systems. Instead of teaching an agent a different custom integration for every service, an MCP server gives the AI application a standardized interface for discovering and using those capabilities. The current MCP specification, released July 28, 2026, also introduces a more stateless protocol core, cacheable list results, header-based routing, authorization hardening, and a formal extensions framework.

For video infrastructure, the potential is much more practical than "chat with your server."

An agent could inspect a failed transcode, check an asset's available renditions, look at delivery information, identify a storage-heavy project, retrieve video metadata, or — when explicitly authorized — trigger a processing operation.

OllaNode is particularly suited to this model because its control plane is already API-first. Its project-scoped REST API exposes video ingestion, processing, playback, CDN, storage, DNS, edge functions, webhooks, and governance capabilities, with MCP available for agents.

This guide shows how to think about that architecture and how to build it safely.

The goal isn't to give an AI unrestricted access to your infrastructure. The goal is to give an agent just enough capability to be useful, while keeping the infrastructure deterministic, observable, and under human control.

---

## Quick Answer: What Do You Need to Control Video Infrastructure with MCP?

| Question | Quick Answer |
| :--- | :--- |
| **What is MCP?** | An open protocol that lets AI applications discover and use tools, resources, and prompts exposed by external systems. |
| **What does MCP add to a video API?** | A standardized agent-facing interface so an AI application can discover video infrastructure capabilities instead of relying on a custom integration for every operation. |
| **Can an AI agent upload and process videos?** | It can, provided the MCP server exposes those operations and the agent's credentials have the required permissions. |
| **Should an agent get write access immediately?** | No. Start with read-only tools, validate behavior, then introduce narrowly scoped write actions behind explicit authorization or approval controls. |
| **Can MCP replace the Ollanode REST API?** | No. MCP is an agent-facing protocol layer. The underlying REST API remains the deterministic control plane. |
| **Can agents monitor long-running transcodes?** | Yes. The agent can inspect job or asset state and decide what to do next instead of holding an HTTP request open while processing occurs. |
| **How should destructive actions work?** | Route them through deterministic permission checks and, where appropriate, human approval rather than relying only on model instructions. |
| **What should I expose first?** | Read-only capabilities such as video lookup, processing status, metadata, project information, and delivery information. |

The basic architecture is straightforward:  
`AI application → MCP client → MCP server → Ollanode API → video infrastructure`

The AI model decides what information or action would help answer a user's request. The MCP layer translates that intent into a structured tool or resource interaction. OllaNode then remains responsible for authentication, authorization, validation, asynchronous processing, storage, playback, and the actual infrastructure operation.

That separation matters. The model should not become your database, job queue, transcoder, or authorization system. It should become a controlled operator that can interact with those systems through well-defined interfaces.

<div class="key-takeaways-box" id="key-takeaways">
  <div class="key-takeaways-header">
    <span class="key-takeaways-icon">✦</span>
    <h3 class="key-takeaways-title">KEY TAKEAWAYS</h3>
  </div>
  <ul class="key-takeaways-list">
    <li>MCP is an interface between AI applications and tools, not a replacement for your infrastructure API. OllaNode's REST API remains the underlying control plane while MCP provides an agent-friendly interaction layer.</li>
    <li><strong>Start with read-only capabilities.</strong> Let an agent inspect videos, jobs, manifests, project settings, and delivery information before giving it the ability to change anything.</li>
    <li>Tools should represent clear actions. <code>get_video_status</code> is easier for an agent to use safely than a vague <code>execute_api_request</code> tool that effectively hands the model an unrestricted HTTP client.</li>
    <li>Resources and tools serve different purposes. Tools perform actions, while resources expose information an AI application can read and use as context.</li>
    <li><strong>Human approval belongs around risky actions.</strong> Deleting assets, changing access policies, purging caches, modifying infrastructure, or triggering expensive processing should use deterministic approval mechanisms.</li>
    <li>Long-running video work should stay asynchronous. The agent should initiate or inspect the job and then reason from its state rather than keeping a request open.</li>
    <li>Good tool descriptions matter. An agent needs to know what a tool does, what arguments it accepts, what it returns, and when it should be used.</li>
    <li>Auditability matters as much as capability. Every agent action should be attributable, inspectable, and revocable.</li>
  </ul>
</div>

## What Is Model Context Protocol (MCP), and Why Does It Matter for Video Infrastructure?

Model Context Protocol is an open standard designed to connect AI applications with external systems that provide data and capabilities.

At a practical level, think of MCP as a standardized language for an AI application to ask:
- What can this server do?
- What tools are available?
- What information can I read?
- What parameters does this action require?
- What happened when I called it?
- What context or resources are available to help me reason about the task?

The current MCP ecosystem includes servers, clients, tools, resources, prompts, authorization, transports, and other protocol capabilities. The official SDK documentation describes MCP as a way for AI applications to connect to systems where their data and tools live.

For a video platform, that changes the integration model. With MCP, the agent-facing layer can expose meaningful capabilities such as `list_videos`, `get_video`, `get_processing_status`, `get_video_manifest`, `get_project_usage`, `retry_processing`, and `create_video`.

The underlying API can remain exactly where it belongs: underneath the abstraction.

This is especially useful for infrastructure because infrastructure APIs tend to contain many operations that are technically valid but operationally dangerous. An agent should receive constrained capabilities with explicit schemas and predictable behavior.

That's the difference between giving an AI access to an API and giving an AI a controlled operational interface.

---

## Understanding the MCP + Ollanode Architecture

OllaNode already has the characteristics an agent-controlled infrastructure platform needs: a project-scoped REST API, authentication and scopes, asynchronous video processing, webhooks, playback controls, CDN operations, and agent governance features. Its API documentation also exposes machine-readable OpenAPI 3.1 information and MCP for agents.

The architecture can be understood as five layers:

1. **AI application**: This is where the model runs — an AI coding assistant, an internal operations assistant, a support agent, or an application you build yourself.
2. **MCP client**: The client connects the AI application to one or more MCP servers and handles protocol interactions.
3. **MCP server**: This is the agent-facing interface. It exposes tools, resources, prompts, and other supported capabilities without forcing the model to understand your entire internal API.
4. **Ollanode control plane**: The MCP server communicates with the OllaNode API using authenticated requests. OllaNode's API uses project-scoped credentials and supports coarse and fine-grained scopes, which gives you a deterministic permission layer beneath the agent.
5. **Video infrastructure**: Where the actual work happens:  
   `Upload → Validation → Metadata extraction → Transcoding → HLS generation → Thumbnails/transcripts → Storage → Webhook → Ready`

OllaNode's long-running video operations run asynchronously in workers rather than blocking request handlers. That distinction becomes extremely important when an AI agent is involved: the model doesn't need to "wait for FFmpeg" — it needs to understand *what started → what state it is in → what happened → what should happen next*.

---

## Before You Start: Prerequisites and Concepts

Before connecting an AI agent to video infrastructure, make sure you understand these concepts:

- **MCP client** — the component in the AI application that connects to an MCP server.
- **MCP server** — the component exposing tools, resources, and prompts.
- **Tool** — a callable capability that performs an operation.
- **Resource** — information that can be read and supplied as context.
- **Prompt** — a reusable prompt template exposed by an MCP server.
- **Transport** — how the MCP client and server communicate (stdio and Streamable HTTP).
- **Authentication & Authorization** — how identity and permissions are verified.
- **Scope** — the specific permission attached to an API credential or action.
- **Approval** — an explicit human authorization step for sensitive operations.
- **Audit trail** — a record showing who or what initiated an operation and what happened.

You should also have:
- A working OllaNode deployment.
- A project with test video assets.
- An API key with the minimum required permissions.
- An MCP-compatible AI application or client.
- A non-production project for initial testing.

Do not begin by connecting an agent to your production account with unrestricted administrative credentials.

---

## Step 1: Understand What an MCP Server Gives an AI Agent

The first mistake people make with MCP is thinking: *"I'll connect my AI to the server and it will understand my infrastructure."* It won't. The agent needs an interface it can reason about.

Suppose you expose `get_video_status` with an input:

```json
{
  "video_id": "vid_123"
}
```

and a response:

```json
{
  "video_id": "vid_123",
  "status": "processing",
  "progress": 72
}
```

That's useful because the model can connect the user's question to a clearly defined operation:  
*"Is the launch video ready yet?"* → identify the video → call `get_video_status` → inspect the result → answer the user.

Now compare that with `run_api_request`, where the model has to construct arbitrary HTTP methods, URLs, headers, and request bodies. The second design is technically flexible, but creates a huge operational risk. Good MCP design starts with the jobs your users actually want to perform.

---

## Step 2: Connect an AI Agent to Your Video Infrastructure

A typical MCP architecture uses an MCP-compatible client to connect to a server. For local development, stdio is useful because the MCP server can run as a subprocess. For a production deployment, Streamable HTTP is a natural fit for remote infrastructure.

Conceptually:  
`AI application → MCP client → MCP video server → Ollanode REST API`

A simplified development configuration might look like:

```json
{
  "mcpServers": {
    "ollanode-video": {
      "url": "https://your-mcp-server.example.com/mcp"
    }
  }
}
```

The important architectural rule: the AI client should connect to the MCP server, and the MCP server should own the integration with OllaNode. Don't put your infrastructure credentials into prompts.

---

## Step 3: Expose Video Operations as MCP Tools

Instead of exposing every REST endpoint directly, create tools around meaningful video operations:
- `list_videos`
- `get_video`
- `get_processing_status`
- `get_video_metadata`
- `get_video_manifest`
- `get_project_usage`
- `get_delivery_stats`
- `create_video`
- `retry_processing`
- `delete_video`

A read-only tool might have a schema like:

```json
{
  "name": "get_processing_status",
  "description": "Get the current processing state for a video asset.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "video_id": {
        "type": "string",
        "description": "The Ollanode video ID."
      }
    },
    "required": ["video_id"]
  }
}
```

The schema gives the model a structured contract. It knows what the tool does, what argument is required, what the argument means, and what operation it should perform.

---

## Step 4: Give Agents Read-Only Visibility First

Before allowing an agent to change infrastructure, make it useful without write access. A strong initial tool set might include:
- `list_projects`
- `list_videos`
- `get_video`
- `get_video_metadata`
- `get_processing_status`
- `get_video_manifest`
- `get_project_usage`
- `get_delivery_stats`

Now imagine asking: *"Which videos failed processing in the last 24 hours?"*

The agent can:
1. Query available videos or processing information.
2. Identify failed assets.
3. Inspect their metadata.
4. Group failures by likely cause.
5. Present the result.

No mutation is required. If an agent can't reliably answer operational questions using read-only tools, adding destructive capabilities won't fix the problem.

---

## Step 5: Let Agents Inspect Video Processing State

Video processing is particularly well suited to agent-based reasoning because the pipeline contains many meaningful states:  
`created → validating → extracting metadata → transcoding → generating HLS → generating thumbnails → generating transcript → storing assets → ready`

A useful MCP tool should expose enough information for an agent to understand the state without forcing it to reconstruct the entire pipeline from raw logs:

```json
{
  "video_id": "vid_123",
  "status": "processing",
  "stage": "transcode",
  "progress": 68,
  "started_at": "2026-08-27T10:15:00Z",
  "updated_at": "2026-08-27T10:19:42Z"
}
```

Now an agent can answer: *"Why isn't this video ready?"* with: *"The asset is currently in the transcode stage at approximately 68% progress. HLS packaging and metadata generation have not completed yet."*

---

## Step 6: Turn Natural-Language Requests Into Controlled Actions

Once read-only operations work reliably, introduce carefully selected write tools (`create_video`, `retry_processing`, `update_video_metadata`).

A user could say: *"Retry the failed processing job for the customer demo."*

The agent should not immediately execute the action. It should first identify:
- which video,
- what failed,
- whether retrying is supported,
- whether the action is allowed,
- whether approval is required.

The AI should not be the final authority on whether an operation is permitted. The model proposes an action; your infrastructure policy on ollanode.com decides whether the action can happen.

---

## Step 7: Add Approval Gates for Destructive Operations

Not every tool deserves the same level of trust:

- **Tier 1 — Read-only:** `list_videos`, `get_video`, `get_processing_status`, `get_manifest`, `get_usage`.
- **Tier 2 — Low-risk writes:** `update_title`, `update_description`, `add_tags`.
- **Tier 3 — Operational actions:** `retry_processing`, `purge_cache`, `change_delivery_settings`.
- **Tier 4 — Destructive or security-sensitive actions:** `delete_video`, `delete_project`, `rotate_credentials`, `change_access_policy`.

OllaNode's architecture includes approval-gated destructive actions, capability discovery, tamper-evident hash-chain audit, and a kill-switch for agent activity.

Most importantly, don't try to solve authorization with a prompt alone. Natural-language instructions cannot replace deterministic authorization boundaries.

---

## Step 8: Use MCP Resources for Video and Infrastructure Context

Tools perform actions; resources provide context:
- `project://video/policies`
- `project://video/encoding-presets`
- `project://video/platform-limits`
- `project://video/playback-policy`
- `project://project/usage`

The agent could read those resources before deciding what to do. For example, when asked *"Can I enable 4K for this project?"*, the agent can inspect the project configuration, encoding preset, source resolution, and storage usage before recommending a change.

---

## Step 9: Design Tool Schemas Agents Can Actually Use

Tool design directly affects agent reliability. Avoid monolithic tools like `manage_video(action, video_id, options)` in favor of explicit tools: `get_video(video_id)`, `retry_processing(video_id)`, `update_video_metadata(...)`, and `delete_video(video_id)`.

Tool descriptions should explicitly specify:
1. What does this tool do?
2. When should it be used?
3. What inputs does it require?
4. What should the agent expect in return?

---

## Step 10: Handle Long-Running Video Jobs Correctly

Video transcoding is asynchronous. The AI application should not hold an open HTTP request waiting for FFmpeg to finish.

Instead:  
`Agent → start processing → job accepted (job ID returned) → agent reports "processing started" → later status check → processing complete → agent verifies output`

This matches how OllaNode handles video processing: asynchronous worker execution rather than blocking the request handler.

---

## Step 11: Add Authentication, Scopes, and Agent Identity

Create a dedicated identity for agent activity and restrict it to the capabilities the agent actually needs:

```yaml
Agent: video-ops-readonly
Allowed:
  - videos:read
  - projects:read
  - processing:read
  - delivery:read
Denied:
  - videos:delete
  - projects:delete
  - credentials:write
```

Separate **identity → authentication → authorization → approval → execution**. Keeping those layers separate makes the system much easier to reason about and secure.

---

## Step 12: Monitor, Audit, and Scale Agent-Controlled Infrastructure

Once agents can operate infrastructure, track:
- Which agent made the request
- Which user initiated the conversation
- Which MCP tool was called
- Which arguments were supplied
- Which API operation was executed
- Which permissions were checked
- Whether approval was required and who approved it
- What the infrastructure returned

A useful audit record might look like:

```json
{
  "actor": "agent:video-ops",
  "user": "user_482",
  "tool": "retry_processing",
  "video_id": "vid_123",
  "approval_id": "apr_789",
  "result": "accepted",
  "request_id": "req_456"
}
```

OllaNode includes capability discovery, approval-gated actions, hash-chain audit, and a kill-switch to ensure complete visibility.

---

## Common MCP + Video Infrastructure Mistakes to Avoid

1. **Giving the agent administrator access on day one.** Start with read-only access.
2. **Exposing a generic API execution tool.** This creates an uncontrollable attack surface.
3. **Treating prompts as security controls.** Natural-language instructions can guide a model but cannot replace deterministic code.
4. **Exposing every endpoint as a separate tool.** A smaller set of well-designed tools is easier for models to use.
5. **Returning massive API responses.** Return clean, structured summaries.
6. **Ignoring asynchronous processing.** Video transcoding is a state machine, not an instant return.
7. **Failing to distinguish user intent from authorization.** A user asking for an action does not bypass permissions.
8. **Forgetting idempotency.** Design write actions so duplicate retries don't create unexpected side effects.

---

## Frequently Asked Questions

<div class="faq-section-container">

### 1. What is Model Context Protocol (MCP)?

Model Context Protocol is an open standard that allows AI applications to connect to external systems that provide tools, resources, prompts, and other capabilities. In simple terms, MCP gives an AI application a standardized way to discover and interact with software outside the model itself. Explore the OllaNode MCP docs on ollanode.com.

### 2. How can MCP control video infrastructure?

An MCP server can expose video infrastructure operations as structured tools. An AI agent can then discover those tools, call them with validated arguments, inspect the results, and decide what to do next. The underlying video platform on ollanode.com still performs the actual operation.

### 3. Can an AI agent upload a video using MCP?

Yes, if the MCP server exposes a video-creation or upload-related tool and the agent has the necessary permission. For production systems, upload and processing operations should be scoped carefully because they can create significant compute and storage usage.

### 4. Can MCP trigger video transcoding?

Yes. A tool such as `start_processing` or `retry_processing` can initiate an asynchronous video processing workflow. The agent should receive a job or asset identifier and then inspect status rather than waiting for the complete transcode in one request. Learn more about OllaNode transcoding pipelines on ollanode.com.

### 5. Is MCP the same thing as an API?

No. An API exposes application capabilities to software clients. MCP is a standardized protocol designed specifically around AI applications interacting with external tools and context. An MCP server can sit on top of an existing REST API.

### 6. Does MCP replace REST APIs?

No. REST can remain the underlying control plane. MCP provides an agent-oriented interface over that API, allowing AI applications to discover and call capabilities in a standardized way. Check out the OllaNode REST API on ollanode.com.

### 7. What is an MCP tool?

An MCP tool is a callable capability exposed by an MCP server. It can perform an operation such as retrieving video status, creating an asset, updating metadata, or starting a workflow. Tools have structured input schemas so models know what arguments are expected.

### 8. What are MCP resources?

Resources provide information that an MCP client can retrieve and use as context. For video infrastructure, resources could represent project policies, encoding presets, playback configuration, usage information, or other structured operational context.

### 9. What are MCP prompts?

Prompts are reusable prompt templates exposed by an MCP server. They help standardize workflows by giving clients structured templates for common operational tasks.

### 10. Is MCP safe for production infrastructure?

MCP can be used in production, but the protocol itself does not make arbitrary infrastructure actions safe. Production deployments still need authentication, authorization, least-privilege permissions, deterministic policy enforcement, logging, approval workflows, and kill-switches. See our security guide on ollanode.com.

### 11. Should AI agents have admin access to video infrastructure?

Generally, no. Give an agent the minimum permissions needed for its specific job. A support agent that only checks processing status should not have permission to delete videos or change project security settings.

### 12. How should MCP handle long-running video processing?

Treat video processing as an asynchronous workflow. The tool should return an accepted state and an identifier that the agent can use to inspect progress later. This matches the asynchronous processing architecture used by OllaNode on ollanode.com.

</div>

---

## Final Takeaway

MCP makes the conversation between AI agents and infrastructure much more practical. Instead of teaching an AI application how to construct arbitrary API requests, you can expose meaningful capabilities such as `get_video`, `get_processing_status`, `get_manifest`, `get_usage`, `retry_processing`, and `create_video`.

For video infrastructure, that creates a useful new operating model:  
**Ask → Inspect → Reason → Request → Approve → Execute → Verify**

The important part isn't giving an AI agent as much control as possible; it's giving the agent the right control. Start read-only, design narrow tools, keep authorization deterministic, treat long-running video operations as asynchronous workflows, log every meaningful action, and add human approval around destructive operations.

With OllaNode's API-first video platform, MCP can sit alongside the existing REST control plane, giving AI agents a structured way to interact with video, processing, playback, CDN, storage, and governance capabilities while keeping the underlying infrastructure under your control.

---

## Related Engineering & Architecture Guides

For deeper technical implementations, explore these related platform resources:

- [AI Agent Security Model: Least Privilege & Scopes](/blog/ai-agent-security-model-least-privilege-scopes-audit-trails)
- [Self-Hosted Video API Lifecycle](/blog/sel-hosted-video-api-upload-processing-playback-webhooks-ans-asset-lifecycles)
- [Developer Video Platform Requirements](/blog/developer-video-platform-requirements-in-2026-apis-authentication-playback-and-observability)
- [OllaNode Architecture & Docs](https://ollanode.com/docs)

