---
title: "Model Context Protocol (MCP) in Action: Controlling Video Infrastructure with AI Agents"
category: "AI & Agents"
excerpt: "An implementation-focused guide to using the Model Context Protocol (MCP) to let AI agents inspect, reason about, and control video infrastructure — from discovering available tools and checking video status to triggering processing workflows, inspecting delivery data, and applying approval-gated actions with Ollanode."
author:
  name: "The Ollanode Team"
  role: "Core Team"
  avatar: "⚡"
publishedDate: "August 27, 2026"
readingTime: "14 min read"
tags: ["MCP", "ModelContextProtocol", "AIAgents", "AIInfrastructure", "VideoInfrastructure", "AgenticAI", "Ollanode", "HLS", "VideoProcessing", "SelfHosted"]
featured: false
---

An implementation-focused guide to using the Model Context Protocol (MCP) to let AI agents inspect, reason about, and control video infrastructure — from discovering available tools and checking video status to triggering processing workflows, inspecting delivery data, and applying approval-gated actions with Ollanode.
---
AI agents are good at deciding what should happen next. Your infrastructure is good at actually doing it.
The awkward part has always been the space between those two things.
An AI assistant can understand a request such as:
"Find the videos that failed processing today, tell me why, and retry the ones that are safe to retry."
But understanding the request is only half the job. The agent needs a reliable way to discover what operations are available, inspect the current state of your infrastructure, provide the right parameters, authenticate correctly, and execute the requested action without accidentally turning a routine task into a production incident.
That's where Model Context Protocol (MCP) becomes interesting.
MCP is an open protocol for connecting AI applications to the tools, resources, and prompts provided by external systems. Instead of teaching an agent a different custom integration for every service, an MCP server gives the AI application a standardized interface for discovering and using those capabilities. The current MCP specification, released July 28, 2026, also introduces a more stateless protocol core, cacheable list results, header-based routing, authorization hardening, and a formal extensions framework. 
For video infrastructure, the potential is much more practical than "chat with your server."
An agent could inspect a failed transcode, check an asset's available renditions, look at delivery information, identify a storage-heavy project, retrieve video metadata, or — when explicitly authorized — trigger a processing operation.
Ollanode is particularly suited to this model because its control plane is already API-first. Its project-scoped REST API exposes video ingestion, processing, playback, CDN, storage, DNS, edge functions, webhooks, and governance capabilities, with MCP available for agents. 
This guide shows how to think about that architecture and how to build it safely.
The goal isn't to give an AI unrestricted access to your infrastructure.
The goal is to give an agent just enough capability to be useful, while keeping the infrastructure deterministic, observable, and under human control.
---
## Quick Answer: What Do You Need to Control Video Infrastructure with MCP?
At a Glance
Question	Quick answer
What is MCP?	An open protocol that lets AI applications discover and use tools, resources, and prompts exposed by external systems.
What does MCP add to a video API?	A standardized agent-facing interface so an AI application can discover video infrastructure capabilities instead of relying on a custom integration for every operation.
Can an AI agent upload and process videos?	It can, provided the MCP server exposes those operations and the agent's credentials have the required permissions.
Should an agent get write access immediately?	No. Start with read-only tools, validate behavior, then introduce narrowly scoped write actions behind explicit authorization or approval controls.
Can MCP replace the Ollanode REST API?	No. MCP is an agent-facing protocol layer. The underlying REST API remains the deterministic control plane.
Can agents monitor long-running transcodes?	Yes. The agent can inspect job or asset state and decide what to do next instead of holding an HTTP request open while processing occurs.
How should destructive actions work?	Route them through deterministic permission checks and, where appropriate, human approval rather than relying only on model instructions.
What should I expose first?	Read-only capabilities such as video lookup, processing status, metadata, project information, and delivery information.
The basic architecture is straightforward:
AI application → MCP client → MCP server → Ollanode API → video infrastructure
The AI model decides what information or action would help answer a user's request. The MCP layer translates that intent into a structured tool or resource interaction. Ollanode then remains responsible for authentication, authorization, validation, asynchronous processing, storage, playback, and the actual infrastructure operation.
That separation matters.
The model should not become your database, job queue, transcoder, or authorization system. It should become a controlled operator that can interact with those systems through well-defined interfaces.
---
## Key Takeaways

<div class="key-takeaways">
  <p><strong>MCP is an interface between AI applications and tools, not a replacement for your infrastructure API:</strong>  Ollanode's REST API remains the underlying control plane while MCP provides an agent-friendly interaction layer.</p>
  <p><strong>Start with read-only capabilities:</strong>  Let an agent inspect videos, jobs, manifests, project settings, and delivery information before giving it the ability to change anything.</p>
  <p><strong>Tools should represent clear actions:</strong>  get_video_status is easier for an agent to use safely than a vague execute_api_request tool that effectively hands the model an unrestricted HTTP client.</p>
  <p><strong>Resources and tools serve different purposes:</strong>  Tools perform actions, while resources expose information an AI application can read and use as context. MCP also supports prompts as reusable interaction templates.</p>
  <p><strong>Human approval belongs around risky actions:</strong>  Deleting assets, changing access policies, purging caches, modifying infrastructure, or triggering expensive processing should use deterministic approval mechanisms rather than relying on an LLM to "remember" to be careful.</p>
  <p><strong>Long-running video work should stay asynchronous:</strong>  A transcoding job can take substantially longer than a normal API request. The agent should initiate or inspect the job and then reason from its state rather than keeping a request open.</p>
  <p><strong>Good tool descriptions matter:</strong>  An agent needs to know what a tool does, what arguments it accepts, what it returns, and when it should be used. MCP maintainers specifically emphasize that tool design affects how reliably models use servers.</p>
  <p><strong>Auditability matters as much as capability:</strong>  Every agent action should be attributable, inspectable, and revocable.</p>
</div>

---
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
For a video platform, that changes the integration model.
Without MCP, you might build a custom agent integration that knows:
GET /v1/videos
GET /v1/videos/{id}
POST /v1/videos
GET /v1/jobs/{id}
POST /v1/videos/{id}/process
Then another agent framework needs a different wrapper.
Then another AI application needs another adapter.
With MCP, the agent-facing layer can expose meaningful capabilities such as:
list_videos
get_video
get_processing_status
get_video_manifest
get_project_usage
retry_processing
create_video
The underlying API can remain exactly where it belongs: underneath the abstraction.
This is especially useful for infrastructure because infrastructure APIs tend to contain many operations that are technically valid but operationally dangerous.
An agent should not necessarily receive a generic:
execute_any_api_request
tool.
It should receive constrained capabilities with explicit schemas and predictable behavior.
That's the difference between giving an AI access to an API and giving an AI a controlled operational interface.
---
## Understanding the MCP + Ollanode Architecture
Ollanode already has the characteristics an agent-controlled infrastructure platform needs: a project-scoped REST API, authentication and scopes, asynchronous video processing, webhooks, playback controls, CDN operations, and agent governance features. Its API documentation also exposes machine-readable OpenAPI 3.1 information and MCP for agents. 
The architecture can be understood as five layers.
1. AI application
This is where the model runs.
It could be an AI coding assistant, an internal operations assistant, a support agent, or an application you build yourself.
2. MCP client
The client connects the AI application to one or more MCP servers and handles protocol interactions.
3. MCP server
This is the agent-facing interface.
It exposes tools, resources, prompts, and other supported capabilities without forcing the model to understand your entire internal API.
4. Ollanode control plane
The MCP server communicates with the Ollanode API using authenticated requests.
Ollanode's API uses project-scoped credentials and supports coarse and fine-grained scopes, which gives you a deterministic permission layer beneath the agent. 
5. Video infrastructure
This is where the actual work happens:
Upload
  ↓
Validation
  ↓
Metadata extraction
  ↓
Transcoding
  ↓
HLS generation
  ↓
Thumbnails / transcripts
  ↓
Storage
  ↓
Webhook
  ↓
Ready
Ollanode's long-running video operations run asynchronously in workers rather than blocking request handlers. 
That distinction becomes extremely important when an AI agent is involved.
The model doesn't need to "wait for FFmpeg."
It needs to understand:
what started → what state it is in → what happened → what should happen next.
---
## Before You Start: Prerequisites and Concepts
Before connecting an AI agent to video infrastructure, make sure you understand these concepts.
- MCP client — the component in the AI application that connects to an MCP server. 
- MCP server — the component exposing tools, resources, and prompts. 
- Tool — a callable capability that performs an operation. 
- Resource — information that can be read and supplied as context. 
- Prompt — a reusable prompt template exposed by an MCP server. 
- Transport — how the MCP client and server communicate. Current MCP implementations support transports such as stdio and Streamable HTTP. 
- Authentication — how the MCP server and underlying infrastructure establish identity. 
- Authorization — what the agent is actually allowed to do. 
- Scope — the specific permission attached to an API credential or action. 
- Approval — an explicit human authorization step for sensitive operations. 
- Audit trail — a record showing who or what initiated an operation and what happened. 
You should also have:
- A working Ollanode deployment or accessible environment. 
- A project with test video assets. 
- An API key with the minimum required permissions. 
- An MCP-compatible AI application or client. 
- A non-production project for initial testing. 
Do not begin by connecting an agent to your production account with unrestricted administrative credentials.
The fastest way to discover whether an agent integration is safe is to give it less access than you think it needs, then add capabilities deliberately.
---
## Step 1: Understand What an MCP Server Gives an AI Agent
The first mistake people make with MCP is thinking:
"I'll connect my AI to the server and it will understand my infrastructure."
It won't.
The agent needs an interface it can reason about.
Suppose you expose:
get_video_status
with an input:
{
  "video_id": "vid_123"
}
and a response:
{
  "video_id": "vid_123",
  "status": "processing",
  "progress": 72
}
That's useful because the model can connect the user's question to a clearly defined operation:
"Is the launch video ready yet?"
→ identify the video
→ call get_video_status
→ inspect the result
→ answer the user.
Now compare that with:
run_api_request
where the model has to construct arbitrary HTTP methods, URLs, headers, query parameters, and request bodies.
The second design is technically flexible.
It's also a much larger operational surface.
Good MCP design therefore starts with the jobs your users actually want to perform, not with a list of every endpoint your API happens to expose.
---
## Step 2: Connect an AI Agent to Your Video Infrastructure
A typical MCP architecture uses an MCP-compatible client to connect to a server.
For local development, stdio is useful because the MCP server can run as a subprocess.
For a production deployment, Streamable HTTP is a natural fit for remote infrastructure. Current MCP SDK documentation supports both approaches, while the July 2026 specification introduced a more stateless protocol core designed to work cleanly with ordinary HTTP infrastructure. 
Conceptually:
AI application
      │
      ▼
   MCP client
      │
      ▼
MCP video server
      │
      ▼
Ollanode REST API
      │
      ├── Videos
      ├── Processing
      ├── Playback
      ├── CDN
      ├── Storage
      └── Governance
For a Python-based implementation, an MCP client can connect to a server URL or a local subprocess depending on the transport being used. The official Python SDK documents both Streamable HTTP and stdio client connections. 
A simplified development configuration might conceptually look like:
{
  "mcpServers": {
    "ollanode-video": {
      "url": "https://your-mcp-server.example.com/mcp"
    }
  }
}
The exact configuration depends on the AI application you are using.
The important architectural rule is this:
The AI client should connect to the MCP server. The MCP server should own the integration with Ollanode.
Don't put your infrastructure credentials into prompts.
---
## Step 3: Expose Video Operations as MCP Tools
This is where the integration becomes genuinely useful.
Instead of exposing every REST endpoint directly, create tools around meaningful video operations.
For example:
list_videos
get_video
get_processing_status
get_video_metadata
get_video_manifest
get_project_usage
get_delivery_stats
create_video
retry_processing
delete_video
A read-only tool might have a schema like:
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
The schema gives the model a structured contract.
It knows:
- what the tool does, 
- what argument is required, 
- what the argument means, 
- and what operation it should perform. 
This is much safer than asking the model to invent an API request.
The official MCP TypeScript SDK describes servers as exposing tools, resources, and prompts, while the current ecosystem supports structured tool results and schema validation. 
---
## Step 4: Give Agents Read-Only Visibility First
Before allowing an agent to change infrastructure, make it useful without write access.
A strong initial tool set might include:
list_projects
list_videos
get_video
get_video_metadata
get_processing_status
get_video_manifest
get_project_usage
get_delivery_stats
Now imagine asking:
"Which videos failed processing in the last 24 hours?"
The agent can:
1.	Query available videos or processing information. 
2.	Identify failed assets. 
3.	Inspect their metadata. 
4.	Group failures by likely cause. 
5.	Present the result. 
No mutation is required.
Another request:
"Is the 4K version of our product demo available?"
The agent could:
1.	Find the asset. 
2.	Read its processing status. 
3.	Inspect its manifest. 
4.	Check for the 4K rendition. 
5.	Answer. 
Again, no write access.
This is the best way to evaluate whether your MCP tool design actually works.
If an agent can't reliably answer operational questions using read-only tools, adding destructive capabilities won't fix the problem.
---
## Step 5: Let Agents Inspect Video Processing State
Video processing is particularly well suited to agent-based reasoning because the pipeline contains many meaningful states.
An asset might be:
created
→ validating
→ extracting metadata
→ transcoding
→ generating HLS
→ generating thumbnails
→ generating transcript
→ storing assets
→ ready
Or it might fail somewhere along the way.
A useful MCP tool should expose enough information for an agent to understand the state without forcing it to reconstruct the entire pipeline from raw logs.
For example:
{
  "video_id": "vid_123",
  "status": "processing",
  "stage": "transcode",
  "progress": 68,
  "started_at": "2026-08-27T10:15:00Z",
  "updated_at": "2026-08-27T10:19:42Z"
}
Now an agent can answer:
"Why isn't this video ready?"
with something substantially more useful than:
"The video is still processing."
It can say:
"The asset is currently in the transcode stage at approximately 68% progress. HLS packaging and metadata generation have not completed yet."
That's the difference between exposing raw infrastructure and exposing operational context.
---
## Step 6: Turn Natural-Language Requests Into Controlled Actions
Once read-only operations work reliably, introduce carefully selected write tools.
For example:
create_video
retry_processing
update_video_metadata
publish_video
A user could say:
"Retry the failed processing job for the customer demo."
The agent should not immediately execute the action.
It should first identify:
- which video, 
- what failed, 
- whether retrying is supported, 
- whether the action is allowed, 
- whether approval is required. 
The resulting flow can be:
User request
     ↓
Agent understands intent
     ↓
Agent identifies asset
     ↓
Agent checks current state
     ↓
Agent checks permissions
     ↓
Approval required?
   ↙       ↘
 yes        no
 ↓           ↓
Human      Execute
approval      ↓
 ↓         API action
Execute        ↓
     ←─────────
          ↓
      Verify state
          ↓
      Report result
This pattern is important because the AI should not be the final authority on whether an operation is permitted.
The model proposes an action.
Your infrastructure policy decides whether the action can happen.
---
## Step 7: Add Approval Gates for Destructive Operations
Not every tool deserves the same level of trust.
A useful way to categorize MCP operations is:
Tier 1 — Read-only
Examples:
list_videos
get_video
get_processing_status
get_manifest
get_usage
These can usually be exposed broadly within an authorized project.
Tier 2 — Low-risk writes
Examples:
update_title
update_description
add_tags
These modify metadata but don't usually affect infrastructure availability.
Tier 3 — Operational actions
Examples:
retry_processing
purge_cache
change_delivery_settings
These should have narrower permissions and stronger logging.
Tier 4 — Destructive or security-sensitive actions
Examples:
delete_video
delete_project
rotate_credentials
change_access_policy
disable_security_controls
These should require explicit authorization and, where appropriate, human approval.
Ollanode's architecture already includes approval-gated destructive/code actions, capability discovery, tamper-evident hash-chain audit, and a kill-switch for agent activity. 
That is the right direction for agent-controlled infrastructure.
Most importantly, don't try to solve authorization with a prompt.
A system instruction saying:
"Never delete production videos without approval."
is useful context.
It is not a security boundary.
MCP maintainers explicitly caution that server instructions cannot guarantee model behavior and that critical security or privacy behavior should be implemented deterministically. 
---
## Step 8: Use MCP Resources for Video and Infrastructure Context
Tools perform actions.
Resources provide context.
That distinction becomes powerful when an agent needs more than one API response to make a useful decision.
Imagine exposing resources representing:
project://video/policies
project://video/encoding-presets
project://video/platform-limits
project://video/playback-policy
project://project/usage
The agent could read those resources before deciding what to do.
For example:
"Can I enable 4K for this project?"
The agent could inspect:
- project configuration, 
- current encoding preset, 
- source resolution, 
- delivery requirements, 
- storage usage. 
Then it can explain the consequences before making a change.
MCP supports resources and resource templates, allowing servers to expose structured information using resource identifiers. 
This is particularly valuable for infrastructure because operational decisions rarely depend on a single API call.
---
## Step 9: Design Tool Schemas Agents Can Actually Use
An MCP server can technically expose hundreds of tools.
That doesn't mean it should.
Tool design directly affects agent reliability.
Compare these two interfaces.
Poor tool
manage_video(
  action,
  video_id,
  options
)
The model must determine what action means and which options are valid for each action.
Better design
get_video(video_id)

retry_processing(video_id)

update_video_metadata(
  video_id,
  title,
  description
)

delete_video(video_id)
The second design creates clearer boundaries.
Tool descriptions should answer four questions:
1.	What does this tool do? 
2.	When should it be used? 
3.	What inputs does it require? 
4.	What should the agent expect in return? 
A good description might be:
Retry processing for a video that is currently in a failed
state. Do not call this tool for videos that are already
processing or ready. Requires video:write permission.
That's far more useful than:
Retries a video.
The MCP ecosystem itself emphasizes that tool descriptions and interface design materially affect how well models use servers. 
---
## Step 10: Handle Long-Running Video Jobs Correctly
This is where traditional API integrations often become awkward.
A user asks:
"Process this 4K video."
The agent calls a processing operation.
The transcoder might take several minutes.
The AI application should not sit there waiting for a normal HTTP request to remain open until FFmpeg finishes.
Instead:
Agent
  ↓
start processing
  ↓
job accepted
  ↓
job ID returned
  ↓
agent reports "processing started"
  ↓
later status check
  ↓
processing complete
  ↓
agent verifies output
The initial response might be:
{
  "accepted": true,
  "video_id": "vid_123",
  "job_id": "job_456",
  "status": "processing"
}
Later:
{
  "job_id": "job_456",
  "status": "completed",
  "outputs": {
    "hls": true,
    "thumbnail": true,
    "transcript": true
  }
}
This matches how Ollanode already handles long-running video processing: asynchronous worker execution rather than blocking the request handler. 
MCP's evolving support for long-running work and Tasks also reflects the broader need for agent workflows to handle operations that don't finish in one request/response interaction. 
The agent's job is therefore not:
"wait until FFmpeg finishes."
It's:
"understand the state of the workflow and decide what to do next."
---
## Step 11: Add Authentication, Scopes, and Agent Identity
AI agents need credentials just like other clients.
But an agent should not receive your personal administrator credential.
Create a dedicated identity for agent activity and restrict it to the capabilities the agent actually needs.
For example:
Agent: video-ops-readonly

Allowed:
  videos:read
  projects:read
  processing:read
  delivery:read

Denied:
  videos:delete
  projects:delete
  credentials:write
Ollanode supports coarse permissions such as read, write, and admin, as well as fine-grained resource/action scopes such as videos:write. 
That gives you a deterministic layer underneath MCP.
The agent may ask to perform an action.
The credential determines whether it can.
For remote MCP deployments, authorization should be treated as a first-class part of the architecture. The July 2026 MCP specification strengthened authorization behavior and introduced additional hardening around issuer validation and client metadata. 
Also separate:
identity → authentication → authorization → approval → execution
These are different problems.
A valid credential proves who is calling.
A scope determines what that identity may do.
An approval determines whether a particular sensitive action is allowed.
The infrastructure executes the operation.
Keeping those layers separate makes the system much easier to reason about.
---
## Step 12: Monitor, Audit, and Scale Agent-Controlled Infrastructure
Once agents can operate infrastructure, you need visibility into both sides of the system.
Track:
- Which agent made the request. 
- Which user initiated the conversation. 
- Which MCP tool was called. 
- Which arguments were supplied. 
- Which API operation was executed. 
- Which permissions were checked. 
- Whether approval was required. 
- Who approved it. 
- What the infrastructure returned. 
- Whether the final state matched expectations. 
A useful audit record might look like:
{
  "actor": "agent:video-ops",
  "user": "user_482",
  "tool": "retry_processing",
  "video_id": "vid_123",
  "approval_id": "apr_789",
  "result": "accepted",
  "request_id": "req_456"
}
This makes the action explainable after the fact.
It also makes debugging much easier.
Suppose a user says:
"I didn't ask the agent to retry that video."
You should be able to reconstruct the chain:
User message
     ↓
Agent decision
     ↓
MCP tool call
     ↓
Approval
     ↓
API request
     ↓
Processing job
Ollanode's documented agent model includes capability discovery, approval-gated actions, hash-chain audit, and a kill-switch. 
Those controls become increasingly important as the number of agent-accessible operations grows.
---
## Common MCP + Video Infrastructure Mistakes to Avoid
1. Giving the agent administrator access on day one
Start with read-only access.
2. Exposing a generic API execution tool
This creates a huge and difficult-to-audit operational surface.
3. Treating prompts as security controls
Natural-language instructions can guide a model but cannot replace deterministic authorization. 
4. Exposing every endpoint as a separate tool without thinking about workflows
More tools do not automatically make an agent more capable.
A smaller set of well-designed tools can be substantially easier for a model to use.
5. Returning huge API responses
Give the model the information it needs.
A 5 MB API response is not a better tool result than a 5 KB structured summary.
6. Making tools ambiguous
Avoid tools whose behavior changes dramatically based on vague parameters.
7. Ignoring asynchronous processing
Video transcoding is not a normal instant API operation. Model the workflow as a state machine.
8. Failing to distinguish user intent from authorization
A user saying "delete this" doesn't automatically mean the agent is permitted to delete it.
9. Forgetting idempotency
Agent workflows may retry operations. Write actions should be designed so duplicate requests don't create unexpected side effects.
10. Logging the result but not the decision path
For agent operations, knowing what happened is useful.
Knowing why the action happened is even more useful.
---
## Troubleshooting Reference
The agent doesn't discover my video tools
Check that the MCP server is reachable, that the client successfully connects, and that the server's tool catalog is being returned correctly.
The agent calls the wrong tool
Improve the tool names and descriptions. Remove overlapping tools that perform nearly identical operations.
The agent repeatedly checks a processing job
Expose a clear status field and return meaningful state transitions. If your architecture supports event-driven updates or long-running task primitives, use them rather than relying entirely on repeated polling.
The agent attempts a destructive operation without approval
Do not solve this with a stronger system prompt alone. Enforce approval at the authorization or gateway layer so the operation cannot execute without the required approval.
The agent receives too much context
Reduce tool output. Return structured summaries and expose detailed information as separately retrievable resources when appropriate.
The MCP server works locally but not remotely
Check transport configuration, authentication, proxy behavior, timeouts, and HTTP routing. The 2026 MCP specification's stateless core is specifically designed to make remote deployments easier to scale across ordinary HTTP infrastructure. 
A tool works but the model uses it unreliably
Inspect its schema and description. Make the purpose, inputs, constraints, and expected outputs explicit.
The agent cannot perform a permitted action
Check the complete chain:
AI client
→ MCP server
→ agent identity
→ API credential
→ scope
→ approval
→ Ollanode API
A failure at any layer can prevent execution.
---
## Monitoring and Observability Checklist
Before allowing an AI agent to control production video infrastructure, confirm you can observe:
- MCP connection health 
- Tool discovery failures 
- Tool invocation counts 
- Tool error rates 
- Tool execution latency 
- Underlying API request IDs 
- Agent identity 
- User identity 
- Permission decisions 
- Approval requests 
- Approval outcomes 
- Long-running processing state 
- Retries 
- Destructive operations 
- Infrastructure state changes 
- Agent kill-switch state 
Also track which tools are actually being used.
If nobody ever calls:
get_project_storage_breakdown
there may be little reason to expose it prominently.
If:
get_processing_status
is called thousands of times per day, it deserves careful attention to caching, rate limits, response size, and latency.
The July 2026 MCP specification added cache hints for list operations, allowing clients to make more informed caching decisions for tool, prompt, and resource listings. 
Observability should therefore cover both agent behavior and infrastructure behavior.
---
## How to Scale AI-Agent Control as Your Video Platform Grows
The first agent integration might have five tools.
A mature video platform could eventually expose dozens.
Don't scale by simply adding more tools.
Scale by introducing capability boundaries.
For example:
Video Operations
list_videos
get_video
create_video
update_video
delete_video
Processing
get_processing_status
retry_processing
get_transcode_outputs
Playback
get_playback_url
get_manifest
get_delivery_status
CDN
get_cache_status
purge_asset
get_edge_analytics
Storage
get_storage_usage
list_storage_objects
Governance
get_agent_capabilities
request_approval
get_audit_event
This makes permissions easier to reason about.
A support agent might get:
Video read
Processing read
Playback read
An operations agent might get:
Video read/write
Processing read/write
CDN read
An infrastructure administrator could receive broader capabilities, still subject to approval requirements for destructive operations.
As the system grows, you can also place policy enforcement between the MCP server and the underlying API:
AI Agent
   ↓
MCP
   ↓
Policy Layer
   ↓
Approval Layer
   ↓
Ollanode API
   ↓
Infrastructure
That architecture keeps the model flexible without making the model responsible for your security model.
---
## Ollanode MCP vs. Building a Custom Agent-to-API Integration
A custom integration can absolutely work.
If you have one internal AI assistant and three API calls, a direct integration may be enough.
The advantage of MCP becomes clearer when you have:
- multiple AI applications, 
- multiple agents, 
- multiple infrastructure capabilities, 
- reusable tool definitions, 
- standardized discovery, 
- shared authorization, 
- structured resources, 
- or a need to move between compatible MCP clients. 
MCP gives you a protocol-level boundary.
Your infrastructure API remains your application-level boundary.
They solve different problems.
Approach	Best for
Direct REST integration	One application with a small number of deterministic API calls
Custom agent wrapper	A specialized internal agent with tightly controlled workflows
MCP server	Multiple AI clients and agents needing standardized access to shared capabilities
MCP + policy/approval layer	Production infrastructure where agents can perform operational actions
The important point is that MCP does not require you to throw away your existing API.
In fact, an API-first infrastructure platform is a strong foundation for MCP because the MCP server can act as an agent-oriented adapter over the existing control plane.
Ollanode's API already provides project-scoped operations across video, CDN, storage, edge, and governance, while its platform documentation explicitly identifies MCP as the agent interface. 
---
## A Note on Costs at This Stage
The cost of adding MCP isn't usually the protocol itself.
The real costs come from:
- AI model inference, 
- additional API calls, 
- MCP server compute, 
- logging and observability, 
- infrastructure operations, 
- video processing triggered by agents, 
- storage created by those operations, 
- and human review for approval-gated workflows. 
This creates an important distinction.
If an agent can trigger a video transcode, then the cost of that action is not "an MCP call."
It is:
MCP interaction → API request → processing job → compute → storage → delivery.
That is why agent permissions should be designed around operational consequences, not just API endpoint names.
An agent that can trigger ten thousand unnecessary transcodes has a much larger cost footprint than one that can only read processing status.
The same principle applies to CDN purges, storage operations, and large-scale metadata updates.
---
## Who Should Follow This Guide
- AI engineers building agents that need access to real infrastructure. 
- Platform engineers exposing video operations to internal AI assistants. 
- DevOps teams exploring agent-controlled infrastructure workflows. 
- Video platform developers who want natural-language operations without replacing their API. 
- SaaS teams building AI-powered support or operations assistants. 
- Security engineers designing approval and authorization boundaries for agent actions. 
- Developers learning MCP who want a practical infrastructure example instead of a toy calculator or weather server. 
- Teams evaluating self-hosted video infrastructure that want both API-first and agent-friendly control. 
---
## Frequently Asked Questions
What is Model Context Protocol (MCP)?
Model Context Protocol is an open standard that allows AI applications to connect to external systems that provide tools, resources, prompts, and other capabilities. In simple terms, MCP gives an AI application a standardized way to discover and interact with software outside the model itself. 
How can MCP control video infrastructure?
An MCP server can expose video infrastructure operations as structured tools. An AI agent can then discover those tools, call them with validated arguments, inspect the results, and decide what to do next. The underlying video platform still performs the actual operation.
Can an AI agent upload a video using MCP?
Yes, if the MCP server exposes a video-creation or upload-related tool and the agent has the necessary permission. For production systems, upload and processing operations should be scoped carefully because they can create significant compute and storage usage.
Can MCP trigger video transcoding?
Yes. A tool such as start_processing or retry_processing can initiate an asynchronous video processing workflow. The agent should receive a job or asset identifier and then inspect status rather than waiting for the complete transcode in one request.
Is MCP the same thing as an API?
No. An API exposes application capabilities to software clients. MCP is a standardized protocol designed specifically around AI applications interacting with external tools and context. An MCP server can sit on top of an existing API.
Does MCP replace REST APIs?
No. REST can remain the underlying control plane. MCP can provide an agent-oriented interface over that API, allowing AI applications to discover and call capabilities in a standardized way.
What is an MCP tool?
An MCP tool is a callable capability exposed by an MCP server. It can perform an operation such as retrieving video status, creating an asset, updating metadata, or starting a workflow. Tools typically have structured input schemas so clients and models know what arguments are expected.
What are MCP resources?
Resources provide information that an MCP client can retrieve and use as context. For video infrastructure, resources could represent project policies, encoding presets, playback configuration, usage information, or other structured operational context. MCP also supports resource templates for parameterized resource identifiers. 
What are MCP prompts?
Prompts are reusable prompt templates exposed by an MCP server. They can help standardize workflows by giving clients structured templates for common tasks. The MCP ecosystem supports prompts alongside tools and resources. 
Is MCP safe for production infrastructure?
MCP can be used in production, but the protocol itself does not make arbitrary infrastructure actions safe. Production deployments still need authentication, authorization, least-privilege permissions, deterministic policy enforcement, logging, approval workflows where appropriate, and the ability to disable agent access.
Should AI agents have admin access to video infrastructure?
Generally, no. Give an agent the minimum permissions needed for its specific job. A support agent that only checks processing status should not have permission to delete videos or change project security settings.
Can an MCP server run remotely?
Yes. Current MCP implementations support remote HTTP-based deployments, and the July 28, 2026 specification introduced a stateless protocol core designed to work with ordinary HTTP infrastructure and load balancing. 
Does MCP require Claude?
No. MCP is an open protocol rather than a protocol restricted to one AI application. MCP-compatible clients can connect to MCP servers, including AI applications and developer tools that implement the protocol. 
Can I build an MCP server in Python?
Yes. The official MCP Python SDK provides server and client functionality, including tools, resources, prompts, authorization, and Streamable HTTP support. 
Can I build an MCP server in TypeScript?
Yes. The official TypeScript SDK provides MCP server functionality for exposing tools, resources, and prompts and supports current MCP implementations. 
How should I protect destructive MCP tools?
Use multiple layers: authentication, fine-grained authorization, deterministic policy checks, explicit approval where appropriate, audit logging, and a kill-switch or equivalent emergency control. Don't rely solely on an instruction telling the model not to perform a destructive operation.
How should MCP handle long-running video processing?
Treat video processing as an asynchronous workflow. The tool should return an accepted state and an identifier that the agent can use to inspect progress later. This matches the asynchronous processing architecture used by Ollanode. 
What should I expose to an AI agent first?
Start with read-only tools:
list_videos
get_video
get_video_metadata
get_processing_status
get_manifest
get_project_usage
Once those are reliable, introduce carefully scoped write operations.
What is the biggest MCP mistake for infrastructure teams?
Giving the agent too much power before establishing reliable boundaries. The better approach is to begin with observation, add narrowly defined actions, introduce approval for sensitive operations, and monitor every agent interaction.
Can MCP work with self-hosted video infrastructure?
Yes. MCP is a protocol layer, so it can sit in front of a self-hosted infrastructure API. This is particularly useful when the organization wants AI agents to interact with infrastructure that remains under its own operational control.
---
## A Practical Validation Pass Before Production
Before allowing an AI agent to control production video infrastructure, run a deliberate validation pass.
Test 1: Tool discovery
Ask the agent:
"What can you do with this video platform?"
Verify that the returned capabilities match what you intended to expose.
Test 2: Read-only lookup
Ask:
"Show me the status of video vid_test123."
Confirm that the agent selects the expected tool and returns the correct result.
Test 3: Ambiguous request
Ask:
"Check the product demo."
If multiple assets could match, the agent should ask for clarification rather than arbitrarily selecting one.
Test 4: Unauthorized action
Ask:
"Delete the production demo."
The agent should be blocked by authorization or approval policy if it lacks the required permission.
Test 5: Approval workflow
Attempt a permitted but approval-gated operation.
Verify:
Agent request
→ approval created
→ human approval
→ execution
→ result
Test 6: Long-running processing
Start a transcode and verify that the agent receives an asynchronous job state rather than waiting indefinitely.
Test 7: Failure recovery
Give the agent a failed processing job.
Ask:
"What happened, and can it be retried?"
The agent should inspect the state first and only initiate a retry when the policy allows it.
Test 8: Audit verification
After every write action, confirm that the audit trail records:
- agent identity, 
- user identity, 
- tool name, 
- arguments, 
- approval, 
- API request, 
- result. 
Test 9: Kill-switch
Disable agent operations and verify that new agent-originated writes are rejected.
Test 10: Permission boundaries
Create a read-only agent credential and confirm that it cannot perform write operations even if the model attempts to call them.
This final test is particularly important.
A secure agent system is not one where the model usually behaves correctly.
It is one where the infrastructure remains safe even when the model behaves incorrectly.
---
## Final Takeaway
MCP makes the conversation between AI agents and infrastructure much more practical.
Instead of teaching an AI application how to construct arbitrary API requests, you can expose meaningful capabilities such as:
get_video
get_processing_status
get_manifest
get_usage
retry_processing
create_video
The agent can then reason over those capabilities while the underlying infrastructure remains responsible for execution, permissions, processing, storage, delivery, and policy.
For video infrastructure, that creates a useful new operating model:
Ask → Inspect → Reason → Request → Approve → Execute → Verify
The important part isn't giving an AI agent as much control as possible.
It's giving the agent the right control.
Start read-only. Design narrow tools. Keep authorization deterministic. Treat long-running video operations as asynchronous workflows. Log every meaningful action. Add human approval around destructive operations. Then expand the agent's capabilities only when the previous layer is reliable.
That's how MCP moves from an interesting AI protocol to something genuinely useful for production infrastructure.
With Ollanode's API-first video platform, MCP can sit alongside the existing REST control plane, giving AI agents a structured way to interact with video, processing, playback, CDN, storage, and governance capabilities while keeping the underlying infrastructure under your control. 
---
Tags: #MCP #ModelContextProtocol #AIAgents #AIInfrastructure #VideoInfrastructure #AgenticAI #Ollanode #HLS #VideoProcessing #SelfHosted
---
## Related Reading
AI & Agents
How AI Agents Can Control Infrastructure Safely: Permissions, Approvals, and Audit Trails
Video Infrastructure
Step-by-Step: How to Generate Dynamic HLS Resolution Ladders (360p to 4K)
Developer Guides
Building an API-First Video Infrastructure Stack for Modern Applications
Video Processing
How Automated Video Transcoding Pipelines Work: From Upload to HLS Playback
Security
API Authentication and Fine-Grained Scopes for Self-Hosted Video Infrastructure
AI Video Workflows
How AI Metadata Can Transform Video Search, Chapters, and Content Discovery

