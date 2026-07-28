import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import path from 'path';

interface Req {
  method: string
}

interface Res {
  setHeader(name: string, value: string): void
  json(data: unknown): void
}

export default function handler(_req: Req, res: Res) {
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
