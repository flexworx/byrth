"""LLM Proxy endpoints — Bedrock-only with action execution and live context.

Supports action-aware mode: when the LLM response contains a roosk_action block,
the action is executed automatically and the result is included in the response.
Injects live platform state and domain knowledge into every request.
"""

import logging

from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.api.schemas.schemas import (
    LLMCompleteRequest, LLMCompleteResponse,
    LLMHealthResponse, LLMStatsResponse,
)
from app.models.models import LLMRequest, SecurityAlert, MurphAgent
from app.services.llm_proxy import llm_proxy
from app.services.proxmox import proxmox_client
from app.services.ai_actions import (
    build_action_system_prompt,
    parse_action_block,
    strip_action_block,
    execute_action,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/llm", tags=["LLM Proxy"])


@router.post("/complete", response_model=LLMCompleteResponse)
async def llm_complete(
    request: LLMCompleteRequest,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Sanitize → route to Bedrock → parse actions → execute → return response.

    Data sanitization runs automatically before any request leaves the server:
    - RFC1918 IPs → [INTERNAL-IP]
    - Sensitive keywords → request rejected
    - VM hostnames → [VM-NAME]
    - Internal paths → stripped

    Action execution: if the LLM response contains a roosk_action block,
    the action is executed and the result is appended to the response.
    """
    # Build live context for the AI
    live_context = ""
    try:
        vms = await proxmox_client.list_vms()
        node_status = await proxmox_client.get_node_status()
        alert_count = await db.scalar(
            select(func.count(SecurityAlert.id)).where(SecurityAlert.resolved == False)
        ) or 0
        agent_count = await db.scalar(select(func.count(MurphAgent.id))) or 0

        live_context = f"""
Current Platform State:
- VMs running: {sum(1 for v in vms if v.get('status') == 'running')}/{len(vms)} total
- CPU usage: {round(node_status.get('cpu', 0) * 100, 1)}%
- RAM usage: {round(node_status.get('memory', {}).get('used', 0) / (1024**3), 1)}GB / {round(node_status.get('memory', {}).get('total', 0) / (1024**3), 1)}GB
- Unresolved alerts: {alert_count}
- Active agents: {agent_count}
- VM list: {', '.join(f"{v.get('name', 'unknown')}(VMID:{v.get('vmid')}={v.get('status', '?')})" for v in vms[:10])}
"""
    except Exception as e:
        logger.warning(f"Failed to gather live context: {e}")
        live_context = "\nNote: Live platform data unavailable (Proxmox may be unreachable).\n"

    # Get domain knowledge — agent-type-aware if specified
    knowledge_context = ""
    agent_prompt_addon = ""
    try:
        from app.services.knowledge_base import get_relevant_knowledge, get_section
        from app.services.agent_types import get_agent_type, get_agent_system_prompt, get_agent_knowledge_sections

        if request.agent_type and request.agent_type != "generic":
            agent_config = get_agent_type(request.agent_type)
            if agent_config:
                agent_prompt_addon = get_agent_system_prompt(request.agent_type)
                # Load specific knowledge sections for this agent type
                sections = get_agent_knowledge_sections(request.agent_type)
                section_texts = []
                for s in sections:
                    text = get_section(s)
                    if text:
                        section_texts.append(text)
                knowledge_context = "Domain Knowledge:\n" + "\n".join(section_texts[:4])
        else:
            knowledge_context = get_relevant_knowledge(request.prompt)
    except ImportError:
        pass

    # Use action-aware system prompt with live context, knowledge, and agent personality
    combined_context = f"{live_context}\n{knowledge_context}"
    if agent_prompt_addon:
        combined_context = f"{agent_prompt_addon}\n\n{combined_context}"
    action_prompt = build_action_system_prompt(knowledge_context=combined_context)

    result = await llm_proxy.complete(
        prompt=request.prompt,
        context=request.context,
        force_backend=request.force_backend,
        system_prompt=action_prompt,
    )

    response_text = result["response"]
    action_executed = False
    action_result = None

    # Check for action block in LLM response
    action_block = parse_action_block(response_text)
    if action_block:
        logger.info(f"AI action detected: {action_block.get('action')}")
        explanation = strip_action_block(response_text)

        action_outcome = await execute_action(
            action_block,
            db=db,
            user_id=user.get("sub"),
        )
        action_executed = True
        action_result = action_outcome

        # Build combined response
        if action_outcome["success"]:
            response_text = explanation
        else:
            response_text = f"{explanation}\n\nAction failed: {action_outcome.get('error', 'Unknown error')}"

    # Persist LLM request to database for stats tracking
    llm_record = LLMRequest(
        backend=result["backend"],
        model=result.get("model", "unknown"),
        prompt_tokens=0,
        completion_tokens=0,
        latency_ms=result["latency_ms"],
        sanitized=result.get("sanitized", False),
        sanitization_actions=result.get("sanitization_actions", []),
    )
    db.add(llm_record)
    await db.commit()

    return LLMCompleteResponse(
        response=response_text,
        backend=result["backend"],
        model=result.get("model", "unknown"),
        latency_ms=result["latency_ms"],
        sanitized=result["sanitized"],
        sanitization_actions=result.get("sanitization_actions", []),
        action_executed=action_executed,
        action_result=action_result,
    )


@router.get("/health", response_model=LLMHealthResponse)
async def llm_health():
    """Check Bedrock connectivity and latency. Ollama shows 'deferred' until GPU added."""
    health = await llm_proxy.health()
    return health


@router.get("/stats", response_model=LLMStatsResponse)
async def llm_stats(
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Usage metrics — request count, avg latency, estimated Bedrock cost (from DB)."""
    total = await db.scalar(select(func.count(LLMRequest.id))) or 0
    bedrock = await db.scalar(
        select(func.count(LLMRequest.id)).where(LLMRequest.backend == "bedrock")
    ) or 0
    ollama = await db.scalar(
        select(func.count(LLMRequest.id)).where(LLMRequest.backend == "ollama")
    ) or 0
    avg_latency = await db.scalar(select(func.avg(LLMRequest.latency_ms))) or 0
    total_cost = await db.scalar(select(func.sum(LLMRequest.estimated_cost_usd))) or 0

    return {
        "total_requests": total,
        "bedrock_requests": bedrock,
        "ollama_requests": ollama,
        "avg_latency_ms": round(float(avg_latency), 1),
        "estimated_cost_usd": round(float(total_cost), 4),
    }
