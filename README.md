# SecureBurn — encrypted messages and files

Educational Flask prototype. Messages and optional attachments are encrypted in the sender's browser with AES-256-GCM before upload. The recipient must enter the access token and secret decryption key separately; an optional additional password can also be required.

## Features
- Text message and optional file attachment (PDF, DOCX, XLSX, TXT, PNG, JPG, WEBP; 8 MiB client-side limit).
- Browser-side AES-256-GCM encryption; key is displayed separately and is not stored by the server.
- Random access token; server stores only its SHA-256 hash.
- Optional additional password; server stores a salted scrypt hash, not the plaintext password.
- One-time access ON/OFF and expiry options.
- HMAC-SHA256 server-side integrity signature over the stored ciphertext metadata.
- Recipient decrypts locally and can download the decrypted attachment.

## Run locally
```bash
python -m venv .venv
# Windows: .venv\\Scripts\\activate
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
python app.py
```
Open http://127.0.0.1:5000. Web Crypto requires HTTPS or localhost.

## Deploy
Set a strong random `SECRET_KEY` environment variable in the hosting dashboard. Use persistent storage for `secureburn.db`; an ephemeral filesystem can erase SQLite data on redeploy/restart. Set HTTPS. Configure a suitable request/body limit at the host too.

## Important security limitations
- Share the link, access token, secret key, and optional password through separate trusted channels. The link itself contains only the message ID.
- A successful server-side open is counted before browser decryption. With one-time access enabled, a wrong decryption key after successful server authorization can consume the message. Test with demo content.
- This prototype does not provide user accounts or owner-only message history/audit dashboard. It records basic open count/first-open time internally, but does not expose a secure owner portal.
- It cannot reliably detect or prevent screenshots, copying, camera capture, or malware on the recipient's device.
- Do not use real credentials, regulated data, or production secrets. This is an academic prototype, not a security-audited product.
