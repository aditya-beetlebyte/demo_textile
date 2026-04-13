import fs from 'fs';
import path from 'path';

/**
 * Local dev: GOOGLE_APPLICATION_CREDENTIALS=./keys/gcp-key.json (gitignored).
 * If the path is missing (e.g. Render without the file), unset it so the app
 * does not point at a non-existent file; use GCP_SERVICE_ACCOUNT_JSON or
 * GCP_SERVICE_ACCOUNT_JSON_BASE64 in env instead (see utils/gcs.js).
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
