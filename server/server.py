# import asyncio
# from email.policy import default
# import base64
# import hashlib
# import secrets
# import jwt
# import socketio
# from dataclasses import dataclass, field
# from pathlib import Path
# from urllib.parse import parse_qs

import io
import time

from google.oauth2 import id_token
from google.auth.transport import requests

from aiohttp import web
from aiohttp.typedefs import Handler
import argparse
import logging
import os
import typing

# import json
import socketio

# Authentication constants
GOOGLE_CLIENT_ID = os.environ.get(
    "GOOGLE_CLIENT_ID",
    "298908306191-c9ng471f6tbh9nt1kiikkpr3n3rduueo.apps.googleusercontent.com",
)

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s"
)
LOG = logging.getLogger(__name__)
sio = socketio.AsyncServer(
    cors_allowed_origins="*",
    async_mode="aiohttp",
    logger=False,
    engineio_logger=False,
)


# These will eventually be database tables, but for now,
# we will use in-memory dictionaries to store user and room data.
class User:
    def __init__(self, id: str, detail: typing.Mapping[str, typing.Any]):
        self.id: str = id
        self.detail: typing.Mapping[str, typing.Any] = detail
        self.sid: str | None = None
        self.room: str | None = None

    def set_room(self: User, room: str | None):
        self.room = room

    def set_socket(self: User, sid: str | None):
        self.sid = sid


users: typing.Dict[str, User] = {}


class Room:
    def __init__(
        self, name: str, game: str, options: typing.Mapping[str, typing.Any] = {}
    ):
        self.name: str = name
        self.game: str = game
        self.options: typing.Mapping[str, typing.Any] = options
        self.members: set[str] = set()

    def add_user(self, user: User):
        if user.sid is not None:
            self.members.add(user.sid)

    def remove_user(self, user: User):
        if user.sid is not None:
            self.members.discard(user.sid)


rooms: typing.Dict[str, Room] = {}


def require_auth(handler: Handler) -> Handler:
    """Decorator - require token or returns 401"""

    async def wrapper(request: web.Request):
        auth: str = request.headers.get("Authorization", default="")
        id_info: typing.Optional[typing.Mapping[str, typing.Any]] = None
        if auth.startswith("Bearer "):
            token: str = auth[7:]
            # validate token from issuer
            try:
                # LOG.info(f"Verifying Google ID token: {token}")
                # Verify the token with Google's ID token verification
                id_info = id_token.verify_oauth2_token(
                    token, requests.Request(), GOOGLE_CLIENT_ID
                )
                # LOG.info(f"Verified Google ID token: {id_info}")
                if id_info["iss"] not in [
                    "accounts.google.com",
                    "https://accounts.google.com",
                ]:
                    raise ValueError("Wrong issuer.")
                if id_info["email_verified"] is not True:
                    raise ValueError("Email not verified.")
            except ValueError as e:
                LOG.error("Invalid ID token: %s", e)
                id_info = None

        if not id_info:
            LOG.warning("Missing or invalid token")
            return web.json_response({"error": "Missing or invalid token"}, status=401)

        user_info: User | None = users.get(id_info["sub"], None)
        if not user_info:
            users[id_info["sub"]] = User(id_info["sub"], id_info)
        # sub is the unique identifier for the user
        # email is the user's email address
        # email_verified is a boolean indicating whether the user's email address has been verified
        # picture is the URL of the user's profile picture
        # name is the user's full name

        return await handler(request)

    return wrapper


async def handle_options(request: web.Request) -> web.Response:
    return web.Response(status=200)


@web.middleware
async def cors_middleware(request: web.Request, handler: Handler) -> web.StreamResponse:
    if request.method == "OPTIONS":
        response = web.Response(status=200)
    else:
        response = await handler(request)

    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = (
        "GET,POST,PUT,PATCH,DELETE,OPTIONS"
    )
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    return response


#
# Background: heart beat
# async def heartbeat():
# 	while True:
# 		await asyncio.sleep(20)
# 		LOG.debug("heartbeat")
#
# async def start_background_tasks(app):
# 	app["heartbeat_task"] = asyncio.create_task(heartbeat())
#
# async def cleanup_background_tasks(app):
# 	app["heartbeat_task"].cancel()
# 	try:
# 		await app["heartbeat_task"]
# 	except asyncio.CancelledError:
# 		pass


#
# Handle the API requests
#
@require_auth
async def handle_get_users(request: web.Request) -> web.Response:
    user_details: list[typing.Mapping[str, typing.Any]] = []
    for id in users:
        user = users.get(id)
        if user:
            ui_user: typing.Mapping[str, typing.Any] = {}
            ui_user["id"] = id
            ui_user["name"] = user.detail.get("name")
            ui_user["email"] = user.detail.get("email")
            ui_user["picture"] = user.detail.get("picture")
            ui_user["room"] = "Room 1"
            user_details.append(ui_user)
    LOG.info(f"Returning user details: {user_details}")
    return web.json_response(user_details)


@require_auth
async def handle_get_rooms(request: web.Request) -> web.Response:
    room_details: list[typing.Mapping[str, typing.Any]] = []
    for id in rooms:
        room = rooms.get(id)
        if room:
            ui_room: typing.Mapping[str, typing.Any] = {}
            ui_room["name"] = room.name
            ui_room["id"] = room.game
            room_details.append(ui_room)
    LOG.info(f"Returning room details: {room_details}")
    return web.json_response(room_details)


@require_auth
async def handle_post_rooms(request: web.Request) -> web.Response:
    # {name: "room-name",
    # game: "sheepshead",
    # options: {
    #  players: 3 | 5,
    #  crack-recrack: false,
    #  double-bump: false,
    #  no-pick: "leaster" | "doubler" | "none",
    #  partner: "jackdiamonds" | "callace" | "none",
    # }
    # }
    try:
        room_data = await request.json()
        LOG.info(f"Received room data: {room_data}")
        name: str | None = room_data.get("name", None)
        game: str | None = room_data.get("game", None)
        options: typing.Mapping[str, typing.Any] | None = room_data.get("options", None)
        # should validate options here, but for now, just store it as-is
        if name is not None and options is not None and game == "sheepshead":
            rooms[name] = Room(name, game, options)
        LOG.info(f"Room created: {name}")
        return web.json_response({"message": "Room created successfully"}, status=201)
    except Exception as e:
        LOG.error(f"Error parsing room data: {e}")
        return web.json_response({"error": "Invalid room data"}, status=400)


# #
# # Handle the socket.io events
# @sio.event
# async def chat_message(sid: str, message: dict):
# 	when = time.time()
# 	user: User = _get_user_by_sid(sid)
# 	chat_message = {
# 		"when": when,
# 		"from": user.detail.get("name", sid),
# 		"data": message['data'],
# 	}
# 	await sio.emit(event='message', data=chat_message, room=user.room, skip_sid=sid)

# @sio.event
# async def join_room(sid, message):
# 	user: User = _get_user_by_sid(sid)
# 	user.set_room(message['room'])
# 	room: Room = rooms.get(message['room'])
# 	room.add_user(user)
# 	await sio.enter_room(sid, room.name)
# 	await sio.emit('my_response', {'data': 'Entered room: ' + message['room']},
#                    room=sid)

# @sio.event
# async def leave_room(sid, message):
# 	user: User = _get_user_by_sid(sid)
# 	user.set_room(None)
# 	room: Room = rooms.get(message['room'])
# 	if room:
# 		room.remove_user(user)
#     await sio.leave_room(sid, message['room'])
#     await sio.emit('my_response', {'data': user.name + 'Left room: ' + message['room']},
#                    room=sid)

# @sio.event
# async def close_room(sid, message):
#     await sio.emit('my_response',
#                    {'data': 'Room ' + message['room'] + ' is closing.'},
#                    room=message['room'])
#     await sio.close_room(message['room'])

# @sio.event
# async def my_room_event(sid, message):
#     await sio.emit('my_response', {'data': message['data']},
#                    room=message['room'])

# @sio.event
# async def connect(sid, environ, auth=None):

#     await sio.emit('my_response', {'data': 'Connected', 'count': 0}, room=sid)

# @sio.event
# async def disconnect(sid, reason):
#     print('Client disconnected, reason:', reason)


#
# entry point
def main() -> int:
    parser = argparse.ArgumentParser(description="")
    parser.add_argument(
        "--port",
        type=int,
        default=8080,
        help="Port to listen start webserver on (default 8080)",
    )
    parser.add_argument(
        "--http",
        action="store_true",
        help="Run plain http - no SSL required (dev mode)",
    )
    args = parser.parse_args()

    app = web.Application(middlewares=[cors_middleware])
    sio.attach(app)

    app.router.add_route("OPTIONS", "/{path:.*}", handle_options)
    app.router.add_get("/api/v1/users", handle_get_users)
    app.router.add_get("/api/v1/rooms", handle_get_rooms)
    app.router.add_post("/api/v1/rooms", handle_post_rooms)

    # add background tasks
    # app.on_startup.append(app, start_background_tasks(app))
    # app.on_cleanup.append(app, cleanup_background_tasks(app))

    web.run_app(app, host="0.0.0.0", port=args.port, ssl_context=None)
    return 0


if __name__ == "__main__":
    exit(main())
