# Messenger ingress

Deployed Supabase function: `zoriana-messenger`, JWT verification disabled only because Meta uses HMAC-SHA256 over the raw body. GET verifies the configured verify token. POST verifies `X-Hub-Signature-256` before parsing/storing messages.

Runtime secrets: `META_APP_SECRET`, `META_VERIFY_TOKEN`, `META_PAGE_ACCESS_TOKEN` (reserved for sending later). Database access uses injected `SUPABASE_SECRET_KEYS.default`, falling back to injected service-role key. No secret values belong in this repository.

Only Zoriana page `1388984880973050` is accepted. Echoes and other pages are ignored. Text is limited to 20,000 characters; binary attachments are not downloaded. A composite database primary key deduplicates retries. Storage errors return 503 so Meta can retry.

The `public.zoriana_messenger_inbox` table has RLS enabled, owner-only SELECT via `emprendimiento_owner_access`, no anonymous grants, and no authenticated write grants. Schema migration applied remotely under `zoriana_messenger_inbox`.

This stage receives messages only. It does not send replies, validate the Page access token against Graph API, call Ollama, or add an inbox UI. Next: complete Meta webhook verification and subscriptions, confirm one test event arrives, then implement authenticated local Ollama processing and controlled sending.

Endpoint verified with live GET 200 and unsigned POST 403. Local tests cover challenge verification, HMAC, tampering, page and echo filtering, batch deduplication and database failures.

The admin panel remains private. Its custom domain is separate from this public, signature-protected receiver.
