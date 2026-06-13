#!/usr/bin/env python3
"""Native messaging host: append clippings to Obsidian vault daily files."""

import json
import struct
import sys
import traceback
from datetime import datetime
from pathlib import Path


def read_message():
    raw_length = sys.stdin.buffer.read(4)
    if not raw_length or len(raw_length) < 4:
        return None
    length = struct.unpack('<I', raw_length)[0]
    if length <= 0 or length > 10_000_000:
        raise ValueError(f'Invalid message length: {length}')
    payload = sys.stdin.buffer.read(length)
    if len(payload) < length:
        raise ValueError('Unexpected end of input while reading message')
    return json.loads(payload.decode('utf-8'))


def send_message(message):
    encoded = json.dumps(message).encode('utf-8')
    sys.stdout.buffer.write(struct.pack('<I', len(encoded)))
    sys.stdout.buffer.write(encoded)
    sys.stdout.buffer.flush()


def clip_to_vault(vault_path, clippings_folder, filename, content, new_file_header):
    if not vault_path or not str(vault_path).strip():
        raise ValueError('Vault path is empty. Set it in extension Settings.')

    vault = Path(vault_path).expanduser().resolve()
    if not vault.exists():
        raise FileNotFoundError(f'Vault not found: {vault}')

    target_dir = vault / (clippings_folder or 'Clippings')
    target_dir.mkdir(parents=True, exist_ok=True)

    file_path = target_dir / filename
    is_new = not file_path.exists()

    with open(file_path, 'a', encoding='utf-8') as handle:
        if is_new:
            header = new_file_header or f"# Clippings — {datetime.now().strftime('%Y-%m-%d')}\n"
            handle.write(header)
            if not header.endswith('\n'):
                handle.write('\n')
        handle.write(content)
        if not content.endswith('\n'):
            handle.write('\n')

    return str(file_path)


def handle_message(message):
    if not isinstance(message, dict):
        raise ValueError('Message must be a JSON object')

    action = message.get('action')

    if action == 'ping':
        return {'ok': True, 'message': 'pong'}

    if action == 'clip':
        file_path = clip_to_vault(
            message.get('vaultPath', ''),
            message.get('clippingsFolder', 'Clippings'),
            message.get('filename', ''),
            message.get('content', ''),
            message.get('newFileHeader'),
        )
        return {'ok': True, 'filePath': file_path}

    return {'ok': False, 'error': f'Unknown action: {action}'}


def main():
    while True:
        message = read_message()
        if message is None:
            break
        try:
            response = handle_message(message)
        except Exception as exc:  # noqa: BLE001
            response = {'ok': False, 'error': str(exc)}
        send_message(response)


if __name__ == '__main__':
    try:
        main()
    except Exception as exc:  # noqa: BLE001
        try:
            send_message({'ok': False, 'error': f'Host crashed: {exc}'})
        except Exception:
            sys.stderr.write(traceback.format_exc())
            sys.stderr.flush()
        sys.exit(1)
