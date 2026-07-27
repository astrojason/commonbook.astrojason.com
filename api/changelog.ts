import { execSync } from 'child_process';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { readFileSync } from 'fs';
import path from 'path';

export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const log = execSync(
    'git log --pretty=format:%h|%s|%ad --date=short -n 50',
    { cwd: process.cwd() }
  ).toString().trim();

  const entries = log.split('\n').filter(Boolean).map(line => {
    const [hash, ...rest] = line.split('|');
    const date = rest.pop() ?? '';
    return { hash, message: rest.join('|'), date };
  });

  const pkg = JSON.parse(readFileSync(path.join(process.cwd(), 'package.json'), 'utf-8'));
  res.json({ version: pkg.version, entries });
}
