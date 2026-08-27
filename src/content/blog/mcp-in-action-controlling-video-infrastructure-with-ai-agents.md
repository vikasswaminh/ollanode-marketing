---
title: "Model Context Protocol (MCP) in Action: Controlling Video Infrastructure with AI Agents"
category: "AI & Agents"
excerpt: "An implementation-focused guide to using the Model Context Protocol (MCP) to let AI agents inspect, reason about,
and control video infrastructure â€” from discovering available tools and checking video status to triggering processing workflows, inspecting delivery data, and applying approval-gated actions with Ollanode."
author:
  name: "The Ollanode Team"
  role: "Core Team"
  avatar: "âš¡"
publishedDate: "August 27, 2026"
readingTime: "14 min read"
tags: ["MCP", "ModelContextProtocol", "AIAgents", "AIInfrastructure", "VideoInfrastructure", "AgenticAI", "Ollanode", "HLS", "VideoProcessing", "SelfHosted"]
featured: false
---

An implementation-focused guide to using the Model Context Protocol (MCP) to let AI agents inspect, reason about,
and control video infrastructure â€” from discovering available tools and checking video status to triggering processing workflows, inspecting delivery data, and applying approval-gated actions with Ollanode.

AI agents are good at deciding what should happen next. Your infrastructure is good at actually doing it.

The awkward part has always been the space between those two things.

An AI assistant can understand a request such as:

> "Find the videos that failed processing today, tell me why, and retry the ones that are safe to retry."

But understanding the request is only half the job. The agent needs a reliable way to discover what operations are available, inspect the current state of your infrastructure, provide the right parameters, authenticate correctly, and execute the requested action without accidentally turning a routine task into a production incident.

That's where Model Context Protocol (MCP) becomes interesting.

MCP is an open protocol for connecting AI applications to the tools, resources, and prompts provided by external systems. Instead of teaching an agent a different custom integration for every service, an MCP server gives the AI application a standardized interface for discovering and using those capabilities. The current MCP specification, released July 28, 2026, also introduces a more stateless protocol core, cacheable list results, header-based routing, authorization hardening, and a formal extensions framework.

For video infrastructure, the potential is much more practical than "chat with your server."

An agent could inspect a failed transcode, check an asset's available renditions, look at delivery information, identify a storage-heavy project, retrieve video metadata, or â€”when explicitly authorizad â€” trigger a processing operation.

Ollanode is particularly suited to this model because its control plane is already API-first. Its project-scoped REST API exposes video ingestion, processing, playback, CDN, storage, DNS, edge functions, webhooks, and governance capabilities, with MCP available for agents.

This guide shows how to think about that architecture and how to build it safely.

The goal isn't to give an AI unrestricted access to your infrastructure.

The goal is to give an agent just enough capabilities to be useful, while keeping the infrastructure deterministic, observable, and under human control.

---"‚ŒˆÈ]ZXÚÈ[œİÙ\ˆÚ]È[İH™YYÈÛÛ›ÛšY[È[™œ˜\İXİ\™HÚ]PÔÂ‚Ÿ]Y\İ[Ûˆ]ZXÚÈ[œİÙ\ˆŸKKHKKHŸ
Š•Ú]\ÈPÔÊŠˆ[ˆÜ[ˆ›İØÛÛ]]ÈRH\XØ][ÛœÈ\ØÛİ™\ˆ[™\ÙHÛÛË™\Ûİ\˜Ù\Ë[™›Û\È^ÜÙYH^\›˜[Ş\İ[\ËˆŸ
Š•Ú]Ù\ÈPÔYÈHšY[ÈTOÊŠˆHİ[™\™^™YYÙ[Y˜XÚ[™È[\™˜XÙHÛÈ[ˆRH\XØ][ÛˆØ[ˆ\ØÛİ™\ˆšY[È[™œ˜\İXİ\™HØ\Xš[]Y\È[œİXYÙˆ™[Z[™ÈÛˆHİ\İÛH[YÜ˜][Ûˆ›Üˆ]™\HÜ\˜][Û‹ˆŸ
ŠØ[ˆ[ˆRHYÙ[\ØY[™›ØÙ\ÜÈšY[ÜÏÊŠˆ]Ø[‹›İšYYHPÔÙ\™\ˆ^ÜÙ\ÈÜÙHÜ\˜][ÛœÈ[™HYÙ[	ÜÈÜ™Y[X[È]™HH™\]Z\™Y\›Z\ÜÚ[ÛœËˆŸ
Š”Úİ[[ˆYÙ[Ù]Üš]HXØÙ\ÜÈ[[YYX][OÊŠˆ›Ëˆİ\Ú]™XY[Û›HÛÛË˜[Y]H™Z]š[Ü‹[ˆ[›ÙXÙH˜\œ›İÛHØÛÜYÜš]HXİ[ÛœÈ™Z[™^XÚ]]]Üš^˜][ÛˆÜˆ\›İ˜[ÛÛ›ÛËˆŸ
ŠØ[ˆPÔ™\XÙHHÛ[›ÙH‘TÕTOÊŠˆ›ËˆPÔ\È[ˆYÙ[Y˜XÚ[™È›İØÛÛ^Y\‹ˆH[™\›Z[™È‘TÕTH™[XZ[œÈH]\›Z[š\İXÈÛÛ›Û[™KˆŸ
ŠØ[ˆYÙ[È[Ûš]ÜˆÛ™Ë\[›š[™È˜[œØÛÙ\ÏÊŠˆY\ËˆHYÙ[Ø[ˆ[œÜXİ›ØˆÜˆ\ÜÙ]İ]H[™XÚYHÚ]ÈÈ™^[œİXYÙˆÛ[™È[ˆ™\]Y\İÜ[ˆÚ[H›ØÙ\ÜÚ[™ÈØØİ\œËˆŸ
Š’İÈÚİ[\İXİ]™HXİ[ÛœÈÛÜšÏÊŠˆ›İ]H[H›İYÚ]\›Z[š\İXÈ\›Z\ÜÚ[ÛˆÚXÚÜÈ[™Ú\™H\›ÜšX]K[X[ˆ\›İ˜[˜]\ˆ[ˆ™[Z[™ÈÛ›HÛˆ[İ[[œİXİ[ÛœËˆŸ
Š•Ú]Úİ[H^ÜÙHš\œİÊŠˆ™XY[Û›HØ\Xš[]Y\ÈİXÚ\ÈšY[ÈÛÚİ\›ØÙ\ÜÚ[™Èİ]\ËY]Y]K›Ú™Xİ[™›Ü›X][Û‹[™[]™\H[™›Ü›X][Û‹ˆ‚•H˜\ÚXÈ\˜Ú]Xİ\™H\Èİ˜ZYÚ›ÜØ\™‚ˆRH\XØ][Û˜8¡¤ˆPÔÛY[8¡¤ˆPÔÙ\™\˜8¡¤ˆÛ[›ÙHTX8¡¤ˆšY[È[™œ˜\İXİ\™X‚•HRH[Ù[XÚY\ÈÚ][™›Ü›X][ÛˆÜˆXİ[ÛˆÛİ[[[œİÙ\ˆH\Ù\‰ÜÈ™\]Y\İˆHPÔ^Y\ˆ˜[œÛ]\È][[[ÈHİXİ\™YÛÛÜˆ™\Ûİ\˜ÙH[\˜Xİ[Û‹ˆÛ[›ÙH[ˆ™[XZ[œÈ™\ÜÛœÚX›H›Üˆ]][XØ][Û‹]]Üš^˜][Û‹˜[Y][Û‹\Ş[˜Ú›Û›İ\È›ØÙ\ÜÚ[™ËİÜ˜YÙK^X˜XÚË[™HXİX[[™œ˜\İXİ\™HÜ\˜][Û‹‚‚•]Ù\\˜][ÛˆX]\œË‚‚•H[Ù[Úİ[›İ™XÛÛYH[İ\ˆ]X˜\ÙK›Øˆ]Y]YK˜[œØÛÙ\‹Üˆ]]Üš^˜][ÛˆŞ\İ[Kˆ]Úİ[™XÛÛYHHÛÛ›ÛYÜ\˜]Üˆ]Ø[ˆ[\˜XİÚ]ÜÙHŞ\İ[\È›İYÚÙ[YYš[™Y[\™˜XÙ\Ë‚‚‹KKB‚ŒÈÈÙ^HZÙX]Ø^\Â‚]ˆÛ\ÜÏHšÙ^K]ZÙX]Ø^\È‚ˆİ›Û™Ï“PÔ\È[ˆ[\™˜XÙH™]ÙY[ˆRH\XØ][ÛœÈ[™ÛÛË›İH™\XÙ[Y[›Üˆ[İ\ˆ[™œ˜\İXİ\™HTNÜİ›Û™ÏˆÛ[›ÙIÜÈ‘TÕTH™[XZ[œÈH[™\›Z[™ÈÛÛ›Û[™HÚ[HPÔ›İšY\È[ˆYÙ[YœšY[™H[\˜Xİ[Ûˆ^Y\‹Ü‚ˆİ›Û™Ï”İ\Ú]™XY[Û›HØ\Xš[]Y\ÎÜİ›Û™Ïˆ][ˆYÙ[[œÜXİšY[ÜË›ØœËX[šY™\İË›Ú™XİÙ][™ÜË[™[]™\H[™›Ü›X][Ûˆ™Y›Ü™HÚ]š[™È]HXš[]HÈÚ[™ÙH[][™ËÜ‚ˆİ›Û™Ï•ÛÛÈÚİ[™\™\Ù[ÛX\ˆXİ[ÛœÎÜİ›Û™ÏˆÛÙO™Ù]İšY[×Üİ]\ÏØÛÙOˆ\ÈX\ÚY\ˆ›Üˆ[ˆYÙ[È\ÙHØY™[H[ˆH˜YİYHÛÙO™^Xİ]WØ\WÜ™\]Y\İØÛÙOˆÛÛ]Y™™Xİ]™[H[™ÈH[Ù[[ˆ[œ™\İšXİYÛY[Ü‚ˆİ›Û™Ï”™\Ûİ\˜Ù\È[™ÛÛÈÙ\™HY™™\™[\œÜÙ\ÎÜİ›Û™ÏˆÛÛÈ\™›Ü›HXİ[ÛœËÚ[H™\Ûİ\˜Ù\È^ÜÙH[™›Ü›X][Ûˆ[ˆRH\XØ][ÛˆØ[ˆ™XY[™\ÙH\ÈÛÛ^ˆPÔ[ÛÈİ\ÜÈ›Û\È\È™]\ØX›H[\˜Xİ[Ûˆ[\]\ËÜ‚ˆİ›Û™Ï’[X[ˆ\›İ˜[™[Û™ÜÈ\›İ[™š\ÚŞHXİ[ÛœÎÜİ›Û™Ïˆ[][™È\ÜÙ]ËÚ[™Ú[™ÈXØÙ\ÜÈÛXÚY\Ë\™Ú[™ÈØXÚ\Ë[ÙYZ[™È[™œ˜\İXİ\˜°½ÈÑÉ¥•É¥¹œ•áÁ•¹Í¥Ù”ÁÉ½•ÍÍ¥¹œÍ¡½Õ±ÕÍ”‘•Ñ•Éµ¥¹¥ÍÑ¥Œ…ÁÁÉ½Ù…°µ•¡…¹¥ÍµÌÉ…Ñ¡•ÈÑ¡…¸É•±å¥¹œ½¸…¸114Ñ¼€‰É•µ•µ‰•ÈˆÑ¼‰”…É•™Õ°¸ğ½Àø(€€ñÀøñÍÑÉ½¹œù1½¹œµÉÕ¹¹¥¹œÙ¥‘•¼İ½É¬Í¡½Õ±ÍÑ…ä…Íå¹¡É½¹½ÕÌèğ½ÍÑÉ½¹œøÑÉ…¹Í½‘¥¹œ©½ˆ…¸Ñ…­”ÍÕ‰ÍÑ…¹Ñ¥…±±ä±½¹•ÈÑ¡…¸„¹½Éµ…°A$É•ÅÕ•ÍĞ¸Q¡”…•¹ĞÍ¡½Õ±¥¹¥Ñ¥…Ñ”½È¥¹ÍÁ•ĞÑ¡”©½ˆ…¹Ñ¡•¸É•…Í½¸™É½´¥ÑÌÍÑ…Ñ”É…Ñ¡•ÈÑ¡…¸­••Á¥¹œ„É•ÅÕ•ÍĞ½Á•¸¸ğ½Àø(€€ñÀøñÍÑÉ½¹œù½½Ñ½½°‘•ÍÉ¥ÁÑ¥½¹Ìµ…ÑÑ•Èèğ½ÍÑÉ½¹œø¸…•¹Ğ¹••‘ÌÑ¼­¹½Üİ¡…Ğ„Ñ½½°‘½•Ì°İ¡…Ğ…ÉÕµ•¹ÑÌ¥Ğ…•ÁÑÌ°İ¡…Ğ¥ĞÉ•ÑÕÉ¹Ì°…¹İ¡•¸¥ĞÍ¡½Õ±‰”ÕÍ•¸5@µ…¥¹Ñ…¥¹•ÉÌÍÁ•¥™¥…±±ä•µÁ¡…Í¥é”Ñ¡…ĞÑ½½°‘•Í¥¸…™™•ÑÌ¡½ÜÉ•±¥…‰±äµ½‘•±ÌÕÍ”Í•ÉÙ•ÉÌ¸ğ½Àø(€€ñÀøñÍÑÉ½¹œùÕ‘¥Ñ…‰¥±¥Ñäµ…ÑÑ•ÉÌ…ÌµÕ …Ì…Á…‰¥±¥Ñäèğ½ÍÑÉ½¹œøÙ•Éä…•¹Ğ…Ñ¥½¸Í¡½Õ±‰”…ÑÑÉ¥‰ÕÑ…‰±”°¥¹ÍÁ•Ñ…‰±”°…¹É•Ù½…‰±”¸ğ½Àø(ğ½‘¥Øø((´´´(## What Is Model Context Protocol (MCP), and Why Does It Matter for Video Infrastructure?

Model Context Protocol is an open standard designed to connect AI applications with external systems that provide data and capabilities.

At a practical level, think of MCP as a standardized language for an AI application to ask:

- What can this server do?
- What tools are available?
- What information can I read?
- What parameters does this action require?
- What happened when I called it?
- What context or resources are available to help me reason about the task?

The currint MCP ecosystem includes servers, clients, tools, resources, prompts, authorization, transports, and other protocol capabilities. The official SDK documentation describes MCP as a way for AI applications to connect to systems where their data and tools live.

For a video platform, that changes the integration model.

Without MCP, you might build a custom agent integration that knows:

 ``http
GET /v1/videos
GET /v1/videos/{id}
POST /v1/videos
GET /v1/jobs/{id}
POST /v1/videos/{id}/process
``p

Then another agent framework needs a different wrapper. Then another AI application needs another adapter.

With MCP, the agent-facing layer can expose meaningful capabilities such as:

- `list_videos`
- `get_video`
- `get_processing_status`
- `get_video_manifest`
- `get_project_usage`
- `retry_processing`
- `create_video`

The underlying API can remain exactly where it belongs: underneath the abstraction.

This is especially useful for infrastructure because infrastructure APIs tend to contain many operations that are technically valid but operationally dangerous.

An agent should not necessarily receive a generic `execute_any_api_request` tool. It should receive constrained capabilities with explicit schemas and predictable behavior.

That's the difference between giving an AI access to an API and giving an AI a controlled operational interface.

---"‚ŒˆÈ[™\œİ[™[™ÈHPÔ
ÈÛ[›ÙH\˜Ú]Xİ\™B‚“Û[›ÙH[™XYH\ÈHÚ\˜Xİ\š\İXÜÈ[ˆYÙ[XÛÛ›ÛY[™œ˜\İXİ\™H]›Ü›H™YYÎˆH›Ú™Xİ\ØÛÜY‘TÕTK]][XØ][Ûˆ[™ØÛÜ\Ë\Ş[˜Ú›Û›İ\ÈšY[È›ØÙ\ÜÚ[™ËÙXšÛÚÜË^X˜XÚÈÛÛ›ÛËÑˆÜ\˜][ÛœË[™YÙ[Ûİ™\›˜[˜ÙH™X]\™\Ëˆ]ÈTHØİ[Y[][Ûˆ[ÛÈ^ÜÙ\ÈXXÚ[™K\™XYX›HÜ[THËŒH[™›Ü›X][Ûˆ[™PÔ›ÜˆYÙ[Ë‚‚•H\˜Ú]Xİ\™HØ[ˆ™H[™\œİÛÙ\Èš]™H^Y\œÎ‚‚ŒKˆ
ŠRH\XØ][ÛŠŠˆ\È\ÈÚ\™HH[Ù[[œÈ
[ˆRHÛÙ[™È\ÜÚ\İ[[\›˜[Ü\˜][ÛœÈ\ÜÚ\İ[İ\ÜYÙ[Üˆİ\İÛH\XØ][ÛŠK‚Œ‹ˆ
Š“PÔÛY[ŠŠˆHÛY[ÛÛ›™XİÈHRH\XØ][ÛˆÈÛ™HÜˆ[Ü™HPÔÙ\™\œÈ[™[™\È›İØÛÛ[\˜Xİ[ÛœË‚ŒËˆ
Š“PÔÙ\™\ŠŠˆ\È\ÈHYÙ[Y˜XÚ[™È[\™˜XÙKˆ]^ÜÙ\ÈÛÛË™\Ûİ\˜Ù\Ë›Û\Ë[™İ\ˆİ\ÜYØ\Xš[]Y\ÈÚ]İ]›Ü˜Ú[™ÈH[Ù[È[™\œİ[™[İ\ˆ[\™H[\›˜[TK‚ˆ
Š“Ó[›ÙHÛÛ›Û[™NŠŠˆHPÔÙ\™\ˆÛÛ[][šXØ]\ÈÚ]HÛ[›ÙHTH\Ú[™È]][XØ]Y™\]Y\İËˆÛ[›ÙIÜÈTH\Ù\È›Ú™Xİ\ØÛÜYÜ™Y[X[È[™İ\ÜÈÛØ\œÙH[™š[™KYÜ˜Z[™YØÛÜ\ËÚXÚÚ]™\È[İHH]\›Z[š\İXÈ\›Z\ÜÚ[Ûˆ^Y\ˆ™[™X]HYÙ[‚Kˆ
Š•šY[È[™œ˜\İXİ\™NŠŠˆ\È\ÈÚ\™HHXİX[ÛÜšÈ\[œÎ‚‚˜^•\ØYˆ8¡¤‚•˜[Y][Û‚ˆ8¡¤ƒY]Y]H^˜Xİ[Û‚ˆ8¡¤ˆ˜[œØÛÙ[™Âˆ8¡¤ˆÈÙ[™\˜][Û‚ˆ8¡¤ˆ[X›˜Z[ÈÈ˜[œØÜš\Âˆ8¡¤„”İÜ˜YÙBˆ8¡¤ˆÙXšÛÚÂˆ8¡¤”™XYB˜B‚“Ó[›ÙIÜÈÛ™Ë\[›š[™ÈšY[ÈÜ\˜][ÛœÈ[ˆ\Ş[˜Ú›Û›İ\ÛH[ˆÛÜšÙ\œÈ˜]\ˆ[ˆ›ØÚÚ[™È™\]Y\İ[™\œË‚‚•]\İ[˜İ[Ûˆ™XÛÛY\È^™[Y[H[\Ü[Ú[ˆ[ˆRHYÙ[\È[›Û™Y‚‚•H[Ù[Ù\Û‰İ™YYÈØZ]›Üˆ‘›\YËˆˆ]™YYÈÈ[™\œİ[™ˆ
ŠÚ]İ\Y8¡¤ˆÚ]İ]H]\È[ˆ8¡¤ˆÚ]\[™Y8¡¤ˆÚ]Úİ[\[ˆ™^Š‚‚‹KKH £"2&Vf÷&R–÷R7F'C¢&W&WV—6—FW2æB6öæ6WG0 ¤&Vf÷&R6öææV7F–ærâ’vVçBFòf–FVò–æg&7G'V7GW&RÂÖ¶R7W&R–÷RVæFW'7FæBF†W6R6öæ6WG3  ¢Ò¢¤Ô56Æ–VçB¢¢(	BF†R6ö×öæVçB–âF†R’Æ–6F–öâF†B6öææV7G2FòâÔ56W'fW"à¢Ò¢¤Ô56W'fW"¢¢(	BF†R6ö×öæVçBW‡÷6–ærFööÇ2Â&W6÷W&6W2ÂæB&ö×G2à¢Ò¢¥FööÂ¢¢(	B6ÆÆ&ÆR6&–Æ—G’F†BW&f÷&×2â÷W&F–öâà¢Ò¢¥&W6÷W&6R¢¢(	B–æf÷&ÖF–öâF†B6â&R&VBæB7WÆ–VB26öçFW‡Bà¢Ò¢¥&ö×B¢¢(	B&WW6&ÆR&ö×BFV×ÆFRW‡÷6VB'’âÔ56W'fW"à¢Ò¢¥G&ç7÷'B¢¢(	B†÷rF†RÔ56Æ–VçBæB6W'fW"6öÖ×Væ–6FRâ7W'&VçBÔ5–×ÆVÖVçFF–öç27W÷'BG&ç7÷'G27V6‚27FF–òæB7G&VÖ&ÆR…EEà¢Ò¢¤WF†VçF–6F–öâ¢¢(	B†÷rF†RÔ56W'fW"æBVæFW&Ç––ær–æg&7G'V7GW&RW7F&Æ—6‚–FVçF—G’à¢Ò¢¤WF†÷&—¦F–öâ¢¢(	Bv†BF†RvVçB—27GVÆÇ’ÆÆ÷vVBFòFòà¢Ò¢¥66÷R¢¢(	BF†R7V6–f–2W&Ö—76–öâGF6†VBFòâ’7&VFVçF–Â÷"7F–öâà¢Ò¢¤&÷fÂ¢¢(	BâW‡Æ–6—B‡VÖâWF†÷&—¦F–öâ7FWf÷"6Vç6—F—fR÷W&F–öç2à¢Ò¢¤VF—BG&–Â¢¢(	B&V6÷&B6†÷v–ærv†ò÷"v†B–æ—F–FVBâ÷W&F–öâæBv†B†VæVBà ¥–÷R6†÷VÆBÇ6ò†fS  ¢Òv÷&¶–æröÆÆæöFRFWÆ÷–ÖVçB÷"66W76–&ÆRVçf—&öæÖVçBà¢Ò&ö¦V7Bv—F‚FW7Bf–FVò76WG2à¢Òâ’¶W’v—F‚F†RÖ–æ–×VÒ&WV—&VBW&Ö—76–öç2à¢ÒâÔ5Ö6ö×F–&ÆR’Æ–6F–öâ÷"6Æ–VçBà¢Òæöâ×&öGV7F–öâ&ö¦V7Bf÷"–æ—F–ÂFW7F–ærà ¤Fòæ÷B&Vv–â'’6öææV7F–ærâvVçBFò–÷W"&öGV7F–öâ66÷VçBv—F‚Vç&W7G&–7FVBFÖ–æ—7G&F—fR7&VFVçF–Ç2à ¥F†Rf7FW7Bv’FòF—66÷fW"v†WF†W"âvVçB–çFVw&F–öâ—26fR—2Fòv—fR—BÆW7266W72F†â–÷RF†–æ²—BæVVG2ÂF†VâFB6&–Æ—F–W2FVÆ–&W&FVÇ’à ¢ÒÒĞ ## Step 1: Understand What an MCO Server Gives an AI Agent

An MCP server reports its capabilities to an AI application.

For video infrastructure, those capabilities usually fall into three categories:

1. **Tools:** Expose actions such as fetching video metadata, checking job status, or triggering processing.
2. **Resources:** Expose context such&jÚâÅ…Ì…¸A$µÍÁ•¥™¥…Ñ¥½¸É•Í½ÕÉ”°„ÁÉ½©•Ğ½¹™¥ÕÉ…Ñ¥½¸É•Í½ÕÉ”°½È…¸…ÍÍ•Ğµ…¹¥™•ÍĞ¸(Ì¸€¨©AÉ½µÁÑÌè¨¨áÁ½Í”É•ÕÍ…‰±”¥¹Ñ•É…Ñ¥½¸Ñ•µÁ±…Ñ•ÌÍÕ …Ì„€‰Ù¥‘•¼ÑÉ½Õ‰±•Í¡½½Ñ¥¹œÁÉ½µÁĞˆ½È„€‰ÍÑ½É…”…Õ‘¥ĞÁÉ½µÁĞ¸ˆ()%¸=±±…¹½‘”°Ñ¡”µ½ÍĞ¥µÁ½ÉÑ…¹Ğ±…å•È¥Ì…±µ½ÍĞ…±İ…åÌÑ½½±Í€‰•…ÕÍ”…•¹ÑÌ¹••Ñ¼Ñ…­”‘•Ñ•Éµ¥¹¥ÍÑ¥Œ…Ñ¥½¹Ì……¥¹ÍĞ•áÁ½Í•A$•¹‘Á½¥¹ÑÌ¸((´´´((ÈŒMÑ•À€Èè½¹¹•Ğ…¸$•¹ĞÑ¼e½ÕÈY¥‘•¼%¹™É…ÍÑÉÕÑÕÉ”()Q¡”5@Í•ÉÙ•È…¸ÉÕ¸±½…±±ä€¡Ù¥„ÍÑ‘¥¼¤½È…Ì„É•µ½Ñ”Í•ÉÙ¥”€¡Ù¥„MÑÉ•…µ…‰±”!QQ@¤¸()Ğ„¡¥ ±•Ù•°°Ñ¡”½¹™¥ÕÉ…Ñ¥½¸±½½­Ì±¥­”Ñ¡¥Ì¥¸…¸5@µ½µÁ…Ñ¥‰±”…•¹Ğ•¹Ù¥É½¹µ•¹Ğè()©Í½¸)ì(€€‰µÁM•ÉÙ•ÉÌˆà{
    "ollanode":Aì(€€€€€€‰½µµ…¹ˆè€‰¹½‘”ˆ°(€€€€€€‰…ÉÌˆèlˆ¸½‘¥ÍĞ½¥¹‘•à¹©Ì‰t°(€€€€€€‰•¹Øˆà{
        "OLLANODE_API_KEY": "olla_reader_12345",
        "OLLANODE_BASE_URL": "https://api.ollanode.com/v1"
      }
    }
  }
}
```

This gives the MCP server the credentials it needs to call Ollanode on behalf of the agent.

---

2# Step 3: Expose Video Operations as MCP Tools

Tools are the primary way an AI agent interacts with video infrastructure.

Each tool needs:
1. An identifier (such as `get_video_status`).
2. A clear, concise description that tells the model when and why to use it.
3. A JSON Schema defining the accepted arguments.
4. An execution handler that calls the Ollanode API and returns the result.

Good tool descriptions are critical. If your description is vague, the model may call the tool with incorrect arguments or fail to call it when needed.

---

2# Step 4: Give Agents Read-Only Visibility First

Before giving an agent the ability to trigger transcodes or delete assets, start with read-only tools:

-  list_videos: Fetches video assets with pagination and filtering.
-  get_video: Fetches detailed metadata for a specific video.
-  get_project_usage: Retrieves storage, transcoding, and bandwidth usage.
-  get_delivery_info: Retrieves CDN,access policy, and playback information.

These read-only tools allow the agent to answer questions about your infrastructure without any risk of mutation.

---

2# Step 5: Let Agents Inspect Video Processing State

When a video is uploaded, it moves through several asynchronous stages: validation, metadata extraction, adaptive bitrate transcoding, HLS packaging, thumbnail generation, and CDN distribution.

An AI agent needs a tool to inspect this state so it can reason about progress or failures.

By exposing a get_processing_status tool, the agent can determine:
- Whether the job is pending, processing, completed, or failed.
-  The current progress percentage.
-  Which renditions have been generated.
-  The exact error message if processing failed.

---"‚ŒˆÈİ\ˆ\›ˆ˜]\˜[S[™İXYÙH™\]Y\İÈ[ÈÛÛ›ÛYXİ[ÛœÂ‚“Û˜ÙH™XY[Û›H[™İ]\Ë[œÜXİ[ÛˆÛÛÈ\™HÛÜšÚ[™ÜË[İHØ[ˆ[›ÙXÙHÜš]HÛÛÈİXÚ\Î‚‚‹HÜ™X]WİšY[Îˆ[š]X]\ÈH™]ÈšY[È\ÜÙ]™XÛÜ™‚‹Hİ\Ü›ØÙ\ÜÚ[™ÎˆšYÙÙ\œÈ˜[œØÛÙ[™ÈÚ]HÜXÚYšXÈ›ØÙ\ÜÚ[™È›Ùš[K‚‹H™]WÜ›ØÙ\ÜÚ[™Îˆ™\İ\ÈH˜Z[Y˜[œØÛÙ[™È›Ø‹‚‚™XØ]\ÙHÛ[›ÙIÜÈTH\È]\›Z[š\İXËHYÙ[Û›İÜÈ^XİHÚ]\˜[Y]\œÈ]™YYÈÈİ\K[™Û[›ÙH˜[Y]\È[H™Y›Ü™Hİ\[™ÈÛÜšË‚‚‹KKH## Step 7: Add Approval Gates for Destructive Operations

Not all actions should be automatic.

IF an agent wants to:
- Delete a video asset
-  Change access policies or DNS records
-  Purge CDN caches
-  Modify infrastructure configurations

The MCP servey or API layer should require approval before executing the action.

This can be achieved by:
- Returning a pending-approval object that requires a human confirmation.
-  Using Ollanode's governance and audit capabilities to log and gate sensitive operations.
-  Enforcing scoped API keys that prevent the agent from executing destructive calls entirely.

---

2# Common Patterns for Controlling Video Infrastructure via MCP

1. **Failed Transcode Diagnostics:** An agent finds failed processing jobs, inspects the error logs, determines if the cause was a temporary network timeout,
   and retries the job after confirmation safety.

2. **Storage Optimization Audits:** An agent lists all video assets, identifies old or unused files that occupy significant storage,
   and prepares an optimization report for human review.
3. **Automated Ingestion & Processing:** An agent triggers video ingestion from an external source, automatically applies the correct hls-resolution-ladder, and monitors until ready.
4. **CDN & Playback Troubleshooting:** An agent inspects the video manifest, verifies delivery endpoints, and detects misconfigured CSP or CORS settings.

---

2# Security and Governance Checklist

kepy your MCP video infrastructure safe with this checklist:

-  [x] Use project-scoped API keys with least privilege.
-  [x] Start with read-only tools before enabling write operations.
-  [x] Enforce high-level, constrained tool schemas rather than raw HTTP clients.
-  [x] Require human approval for destructive or costly actions.
-  [x] Log all agent interactions with attribution and timestamps.
-  [x] Keep video transcoding asynchronous instead of holding connections open.
-  [x] Validate all input parameters at the Ollantide API layer.

---

2# Troubleshooting Common MCP + Video Infrastructure ISsues

| Issue | Cause | Resolution |
| --- | --- | --- |
| **Tool not discovered** | Incorrect MCP server configuration or missing name. | Check configuration and ensure the MCP server reports the tool in its capabilities. |
| **Invalid arguments passed** | Vague or poorly defined JSON Schema. | Provide explicit field descriptions and required properties in the tool schema. |
| **401 / 403 Unauthorized** | Missing or insufficient API key scopes. | Verify that the OLLANODE_API_KEY provided the MCP server has the required permissions. |
| **Transport timeout** | Agent attempting to wait synchronously for job completion. | Use asynchronous status polling or webhook notifications instead. |

---

2# Next Steps

1. **Discover the OLlainode API:** Review the Ollanode API Documentation to see all available endpoints.
2. **Inspect MCP Capabilities:** Explore the MCP Specification to learn more about tools, resources, and prompts.:
3. **Start Building: ** Connect your first read-only MCP server to an Ollantide test project and start exploring agent-controlled video infrastructure.
