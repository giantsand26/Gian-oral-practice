# Security

Gian Oral Practice is designed for a private Mac and a private Tailscale
tailnet. Keep the API bound to `127.0.0.1`, use Tailscale **Serve**, and never
use Tailscale Funnel or a public reverse proxy for private practice data.
Set `GIAN_ALLOWED_HOSTS` to your one exact `.ts.net` hostname. The gateway
rejects other Host headers to reduce DNS-rebinding risk.

Real reports and the ingestion token live in `.runtime/`, which is excluded
from Git. Do not commit `AGENTS.md`, `.runtime/`, environment files, ChatGPT
project/thread/message IDs, Tailscale hostnames, or exported practice reports.

To report a vulnerability without publishing private data, contact the author
through [@JYNong26 on X](https://x.com/JYNong26).
