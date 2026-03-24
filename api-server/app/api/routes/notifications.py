"""Real-time notifications via WebSocket.

Clients connect with ?token=<JWT> and receive push notifications
as JSON messages. Also supports a REST endpoint for fetching
recent notifications.
"""

import asyncio
import json
import logging
from datetime import datetime, timezone
from typing import Dict, Set

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query

from app.core.security import decode_token

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/notifications", tags=["Notifications"])

# In-memory connected clients: user_id -> set of websockets
_connections: Dict[str, Set[WebSocket]] = {}


async def broadcast_to_user(user_id: str, message: dict):
    """Send a notification to all connected sessions of a user."""
    if user_id in _connections:
        dead = set()
        for ws in _connections[user_id]:
            try:
                await ws.send_json(message)
            except Exception:
                dead.add(ws)
        _connections[user_id] -= dead
        if not _connections[user_id]:
            del _connections[user_id]


async def broadcast_all(message: dict):
    """Send a notification to all connected users."""
    for user_id in list(_connections.keys()):
        await broadcast_to_user(user_id, message)


@router.websocket("/ws")
async def notifications_ws(
    websocket: WebSocket,
    token: str = Query(...),
):
    """WebSocket endpoint for real-time notifications.

    Connect with ?token=<JWT>. Server pushes notifications as:
      {"type": "notification", "payload": {...}}
    
    Client can send {"type": "ping"} to keep alive.
    Server responds with {"type": "pong"}.
    """
    # Authenticate
    try:
        user = decode_token(token)
    except Exception:
        await websocket.accept()
        await websocket.close(code=4001, reason="Invalid or expired token")
        return

    user_id = user.get("sub", "unknown")
    await websocket.accept()

    # Register connection
    if user_id not in _connections:
        _connections[user_id] = set()
    _connections[user_id].add(websocket)
    logger.info("Notifications WS: user=%s connected (%d sessions)",
                user_id, len(_connections[user_id]))

    try:
        # Send initial connection confirmation
        await websocket.send_json({
            "type": "connected",
            "payload": {
                "user_id": user_id,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            },
        })

        # Keep connection alive, handle client messages
        while True:
            try:
                raw = await asyncio.wait_for(
                    websocket.receive_text(),
                    timeout=60.0,
                )
                try:
                    msg = json.loads(raw)
                    if msg.get("type") == "ping":
                        await websocket.send_json({"type": "pong"})
                except json.JSONDecodeError:
                    pass
            except asyncio.TimeoutError:
                # Send keepalive ping
                try:
                    await websocket.send_json({"type": "ping"})
                except Exception:
                    break

    except WebSocketDisconnect:
        logger.info("Notifications WS: user=%s disconnected", user_id)
    except Exception as exc:
        logger.warning("Notifications WS: user=%s error: %s", user_id, exc)
    finally:
        # Unregister
        if user_id in _connections:
            _connections[user_id].discard(websocket)
            if not _connections[user_id]:
                del _connections[user_id]
        try:
            await websocket.close()
        except Exception:
            pass


@router.get("/")
async def get_notifications():
    """Return recent notifications (placeholder — will integrate with DB)."""
    return {
        "notifications": [],
        "unread_count": 0,
        "connected_users": len(_connections),
    }
