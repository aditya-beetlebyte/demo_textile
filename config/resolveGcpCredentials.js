import fs from 'fs';
import path from 'path';

/**
 * Local dev: .env may set GOOGLE_APPLICATION_CREDENTIALS=./keys/gcp-key.json
 * with docker-compose mounting ./keys (file is gitignored).
 * Production: that path does not exist — unset so @google-cloud uses the
 * runtime service account (Cloud Run / GCE metadata) instead of ENOENT.
 */
const raw = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
if (!raw) {
  delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
} else {
  const resolved = path.isAbsolute(raw) ? raw : path.resolve(process.cwd(), raw);
  try {
    const st = fs.statSync(resolved);
    if (st.isFile()) {
      process.env.GOOGLE_APPLICATION_CREDENTIALS = resolved;
    } else {
      delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
    }
  } catch {
    delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
  }
}
