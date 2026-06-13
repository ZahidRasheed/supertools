#!/usr/bin/env python3
"""Native messaging host: append clippings to Obsidian vault daily files."""

import json
import struct
import sys
from datetime import datetime
from pathlib import Path


def read_message():
    raw_length = sys.stdin.buffer.read(4)
    if len(raw_length) == 0:
        return None
    if len(raw_length) < 4:
        return None
    length = struct.unpack('<I', raw_length)[0]
    payload = sys.stdin.buffer.read(length)
    if len(payload) < length:
        return None
    return json.loads(payload.decode('utf-8'))


def send_message(message):
    encoded = json.dumps(message).encode('utf-8')
    sys.stdout.buffer.write(struct.pack('<I', len(encoded)))
    sys.stdout.buffer.write(encoded)
    sys.stdout.buffer.flush()


def clip_to_vault(vault_path, clippings_folder, filename, content, new_file_header):
    vault = Path(vault_path).expanduser().resolve()
    if not vault.exists():
        raise FileNotFoundError(f'Vault not found: {vault}')

    target_dir = vault / clippings_folder
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
    action = message.get('action')

    if action == 'ping':
        return {'ok': True, 'message': 'pong'}

    if action == 'clip':
        file_path = clip_to_vault(
            message['vaultPath'],
            message.get('clippingsFolder', 'Clippings'),
            message['filename'],
            message['content'],
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
        except Exception as exc:  # noqa: BLE001 — report all errors to extension
            response = {'ok': False, 'error': str(exc)}
        send_message(response)


if __name__ == '__main__':
    main()
