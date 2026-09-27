# 🎙️ Kemp Voice

A multi-token Discord voice channel joiner built with Python, featuring a clean desktop UI powered by pywebview + Flask.

## Features

- **Multi-token support** — connect dozens of tokens simultaneously to any voice channel
- **Auto-reconnect** — tokens reconnect automatically if kicked or disconnected
- **Status modes** — set tokens to DND, Idle, or VR spoofed presence (Meta Quest 3, Valve Index, PlayStation VR2, Apple Vision Pro)
- **Mute/Deaf control** — join muted, deafened, or unmuted per token or randomized
- **Mass actions** — move all tokens to a new channel, mute/deaf all, disconnect all
- **Per-token control** — move, change status, or kick individual tokens from the UI
- **Live connection table** — real-time view of all connected tokens with their username, server, channel and status
- **Activity log** — timestamped terminal with color-coded events
- **Desktop app** — runs as a native window, no browser needed

## Stack

- Python 3.10+
- aiohttp (Discord Gateway WebSocket)
- Flask (local backend)
- pywebview (desktop window)

## Setup

```bash
pip install aiohttp flask pywebview requests
python app.py
```

## Usage

1. Paste your tokens in the tokens field
2. Enter the Server ID and Voice Channel ID
3. Choose your status and mute mode
4. Click **Join Voice Channel**

## Disclaimer

This tool is for educational purposes only.
Use at your own risk. Selfbots violate Discord's Terms of Service.
