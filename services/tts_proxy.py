#!/usr/bin/env python3
"""Small CORS-enabled proxy between 小智 and a local GPT-SoVITS API."""

import json
import os
import re
import unicodedata
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


ROOT = Path(__file__).resolve().parent
CONFIG_PATH = Path(os.getenv("ORBI_VOICE_CONFIG", ROOT / "voice" / "config.json"))
GPT_SOVITS_URL = os.getenv("GPT_SOVITS_URL", "http://127.0.0.1:9880/tts")
ASCII_TOKEN_CHARACTERS = "A-Za-z0-9"


def apply_pronunciation_map(text, pronunciation_map=None):
    """Replace configured ASCII terms without matching inside longer identifiers."""
    if not isinstance(pronunciation_map, dict):
        return text

    replacements = sorted(pronunciation_map.items(), key=lambda item: len(str(item[0])), reverse=True)
    for source, spoken in replacements:
        if not isinstance(source, str) or not source or not isinstance(spoken, str) or not spoken:
            continue
        pattern = rf"(?<![{ASCII_TOKEN_CHARACTERS}]){re.escape(source)}(?![{ASCII_TOKEN_CHARACTERS}])"
        text = re.sub(pattern, spoken, text, flags=re.IGNORECASE)
    return text


def normalize_speech_text(value, pronunciation_map=None):
    """Return classroom narration without markup or invisible characters."""
    text = unicodedata.normalize("NFKC", str(value or ""))
    text = re.sub(r"```(?:[^\n]*\n)?(.*?)```", r"\1", text, flags=re.DOTALL)
    text = re.sub(r"!\[([^\]]*)\]\([^)]*\)", r"\1", text)
    text = re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", text)
    text = re.sub(r"https?://\S+", "", text)
    text = re.sub(r"<[^>]+>", "", text)
    text = re.sub(r"(?m)^\s{0,3}(?:#{1,6}|>|[-+*]|\d+[.)])\s+", "", text)
    text = re.sub(r"[`*_~]", "", text)
    text = apply_pronunciation_map(text, pronunciation_map)
    text = "".join(
        character
        for character in text
        if character in "\n\t" or unicodedata.category(character) not in {"Cc", "Cf", "Cs", "So"}
    )
    text = re.sub(r"\s+", " ", text).strip()
    if not re.search(r"[\u3400-\u9fffA-Za-z0-9]", text):
        return ""
    return text


def build_tts_payload(text, stream, config):
    return {
        "text": text,
        # This classroom voice is Chinese-first. Do not let short fragments fall
        # back to GPT-SoVITS' automatic CJK language detection.
        "text_lang": "zh",
        "ref_audio_path": config["ref_audio_path"],
        "prompt_text": config["prompt_text"],
        "prompt_lang": config.get("prompt_lang", "zh"),
        "text_split_method": config.get("text_split_method", "cut2"),
        "media_type": "wav",
        "streaming_mode": config.get("streaming_mode", 1) if stream else False,
        "fragment_interval": config.get("fragment_interval", 0.08),
        "speed_factor": config.get("speed_factor", 1.0),
        "top_k": config.get("top_k", 15),
        "top_p": config.get("top_p", 0.7),
        "temperature": config.get("temperature", 0.6),
        "repetition_penalty": config.get("repetition_penalty", 1.35),
        "seed": config.get("seed", 12345),
    }


def load_voice_config():
    if not CONFIG_PATH.is_file():
        raise FileNotFoundError(
            f"Missing {CONFIG_PATH}. Copy config.example.json to config.json and add reference.wav."
        )

    config = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    reference_path = Path(config.get("ref_audio_path", "reference.wav"))
    if not reference_path.is_absolute():
        reference_path = CONFIG_PATH.parent / reference_path
    if not reference_path.is_file():
        raise FileNotFoundError(f"Reference audio not found: {reference_path}")

    config["ref_audio_path"] = str(reference_path.resolve())
    return config


class Handler(BaseHTTPRequestHandler):
    def send_cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")

    def send_json(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_cors_headers()
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_cors_headers()
        self.end_headers()

    def do_GET(self):
        if self.path != "/health":
            self.send_json(404, {"error": "not_found"})
            return
        try:
            config = load_voice_config()
            self.send_json(200, {"status": "ok", "voice": config.get("name", "小智·芙宁娜")})
        except (OSError, ValueError, json.JSONDecodeError) as error:
            self.send_json(503, {"status": "not_configured", "error": str(error)})

    def do_POST(self):
        if self.path != "/tts":
            self.send_json(404, {"error": "not_found"})
            return

        stream_started = False
        try:
            length = int(self.headers.get("Content-Length", "0"))
            request_data = json.loads(self.rfile.read(length) or b"{}")
            raw_text = str(request_data.get("text", "")).strip()
            stream = request_data.get("stream", True) is not False
            if not raw_text:
                self.send_json(400, {"error": "text_required"})
                return
            if len(raw_text) > 4000:
                self.send_json(413, {"error": "text_too_long"})
                return

            config = load_voice_config()
            text = normalize_speech_text(raw_text, config.get("pronunciation_map"))
            if not text:
                self.send_json(400, {"error": "no_speakable_text"})
                return

            payload = build_tts_payload(text, stream, config)
            print(
                "[xiaozhi-tts] synth "
                f"chars={len(text)} lang={payload['text_lang']} "
                f"mode={payload['streaming_mode']} temperature={payload['temperature']} "
                f"top_p={payload['top_p']}"
            )
            upstream_request = urllib.request.Request(
                GPT_SOVITS_URL,
                data=json.dumps(payload).encode("utf-8"),
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            with urllib.request.urlopen(upstream_request, timeout=120) as response:
                if stream:
                    self.send_response(200)
                    self.send_header("Content-Type", "audio/wav")
                    self.send_header("Cache-Control", "no-store")
                    self.send_header("X-Content-Type-Options", "nosniff")
                    self.send_header("Connection", "close")
                    self.send_cors_headers()
                    self.end_headers()
                    stream_started = True
                    while chunk := response.read(16384):
                        self.wfile.write(chunk)
                        self.wfile.flush()
                    self.close_connection = True
                    return

                audio = response.read()
                self.send_response(200)
                self.send_header("Content-Type", "audio/wav")
                self.send_header("Content-Length", str(len(audio)))
                self.send_header("Cache-Control", "no-store")
                self.send_cors_headers()
                self.end_headers()
                self.wfile.write(audio)
        except urllib.error.HTTPError as error:
            detail = error.read().decode("utf-8", errors="replace")
            self.send_json(502, {"error": "gpt_sovits_error", "detail": detail})
        except (BrokenPipeError, ConnectionResetError):
            # The browser aborted an in-flight stream (for example, barge-in).
            pass
        except (OSError, ValueError, json.JSONDecodeError) as error:
            if stream_started:
                self.close_connection = True
            else:
                self.send_json(503, {"error": "tts_unavailable", "detail": str(error)})

    def log_message(self, message, *args):
        print(f"[xiaozhi-tts] {self.address_string()} {message % args}")


if __name__ == "__main__":
    port = int(os.getenv("ORBI_TTS_PORT", "8787"))
    print(f"小智·芙宁娜 TTS proxy listening on http://127.0.0.1:{port}")
    ThreadingHTTPServer(("127.0.0.1", port), Handler).serve_forever()
