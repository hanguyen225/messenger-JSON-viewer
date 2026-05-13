import type { NextApiRequest, NextApiResponse } from 'next';
import { promises as fs } from 'fs';

type ResponseData = {
  ok?: boolean;
  error?: string;
};

const ARCHIVE_PATH = process.env.ARCHIVE_PATH || '/app/archive';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    await fs.access(ARCHIVE_PATH);
    await fs.access(`${ARCHIVE_PATH}/inbox`);
    res.status(200).json({ ok: true });
  } catch {
    res.status(404).json({ error: 'Archive path not found' });
  }
}