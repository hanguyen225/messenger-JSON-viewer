import type { NextApiRequest, NextApiResponse } from 'next';
import { promises as fs } from 'fs';
import path from 'path';

const ARCHIVE_PATH = process.env.ARCHIVE_PATH || '/app/archive';

function extractMessagePartIndex(fileName: string): number {
  const match = fileName.match(/^message(?:_?(\d+))?\.json$/i);
  if (!match) {
    return Number.MAX_SAFE_INTEGER;
  }

  if (!match[1]) {
    return Number.MAX_SAFE_INTEGER;
  }

  return parseInt(match[1], 10);
}

function buildMessageKey(message: Record<string, unknown>) {
  const timestamp = message.timestamp_ms ?? 0;
  const sender = message.sender_name ?? '';
  const body = JSON.stringify(
    message.content ??
    message.photos ??
    message.videos ??
    message.audio ??
    message.audio_files ??
    message.files ??
    message.gifs ??
    message.media ??
    ''
  );

  return `${String(timestamp)}-${String(sender)}-${body}`;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { dirName } = req.query;
    if (!dirName || typeof dirName !== 'string') {
      res.status(400).json({ error: 'Invalid conversation directory' });
      return;
    }

    const inboxPath = path.resolve(path.join(ARCHIVE_PATH, 'inbox'));
    const conversationPath = path.resolve(path.join(inboxPath, dirName));

    if (
      conversationPath !== inboxPath &&
      !conversationPath.startsWith(`${inboxPath}${path.sep}`)
    ) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const entries = await fs.readdir(conversationPath, { withFileTypes: true });
    const messageFiles = entries
      .filter((entry) => entry.isFile() && /^message(?:_?\d+)?\.json$/i.test(entry.name))
      .map((entry) => entry.name)
      .sort((a, b) => {
        const ai = extractMessagePartIndex(a);
        const bi = extractMessagePartIndex(b);

        if (ai !== bi) {
          return ai - bi;
        }

        return a.localeCompare(b);
      });

    if (messageFiles.length === 0) {
      res.status(404).json({ error: 'No message JSON files found' });
      return;
    }

    const merged: Record<string, unknown> = {
      participants: [],
      title: '',
      image: null,
      messages: [],
    };

    const mergedMessages: Record<string, unknown>[] = [];

    for (const fileName of messageFiles) {
      const filePath = path.join(conversationPath, fileName);
      const content = await fs.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(content) as Record<string, unknown>;

      if (!merged.title && typeof parsed.title === 'string') {
        merged.title = parsed.title;
      }

      if (
        Array.isArray(parsed.participants) &&
        Array.isArray(merged.participants) &&
        merged.participants.length === 0
      ) {
        merged.participants = parsed.participants;
      }

      if (!merged.image && parsed.image) {
        merged.image = parsed.image;
      }

      if (Array.isArray(parsed.messages)) {
        for (const msg of parsed.messages) {
          if (msg && typeof msg === 'object') {
            mergedMessages.push(msg as Record<string, unknown>);
          }
        }
      }
    }

    const seen = new Set<string>();
    const dedupedMessages: Record<string, unknown>[] = [];

    for (const msg of mergedMessages) {
      const key = buildMessageKey(msg);
      if (!seen.has(key)) {
        seen.add(key);
        dedupedMessages.push(msg);
      }
    }

    dedupedMessages.sort((a, b) => {
      const at = Number(a.timestamp_ms || 0);
      const bt = Number(b.timestamp_ms || 0);
      return at - bt;
    });

    merged.messages = dedupedMessages;

    res.setHeader('Content-Type', 'application/json');
    res.status(200).send(JSON.stringify(merged));
  } catch (error: unknown) {
    const e = error as NodeJS.ErrnoException;
    if (e.code === 'ENOENT') {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }

    console.error('Archive messages merge error:', error);
    res.status(500).json({ error: 'Failed to read conversation messages' });
  }
}
