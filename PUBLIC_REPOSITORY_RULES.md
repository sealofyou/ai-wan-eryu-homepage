# Public Repository Rules

This repository may be published as the public source for the AI玩尔玉 homepage.

## Allowed

- Public personal introduction and public-facing profile copy.
- Public articles, notes, project summaries, and openly shareable screenshots.
- The approved desk composition, generated visual assets, and public brand marks.
- Build scripts, tests, dependency manifests, and local development instructions.

## Never publish

- API keys, access tokens, passwords, cookies, SSH keys, certificates, or `.env` files.
- Private URLs, server IPs, deployment hostnames, firewall rules, or infrastructure credentials.
- Raw private photos, unredacted screenshots, logs, backups, archives, or internal task prompts.
- Local absolute paths, private Feishu links, account identifiers, or unpublished work.

## Before every public push

1. Inspect the file list and the diff.
2. Scan text files for credentials, private links, server addresses, and internal paths.
3. Review new images manually for private information and publication permission.
4. Run `npm test`, `npm run check`, and `npm run build`.
5. Publish only from a clean history that never contained excluded material.

When uncertain, keep the file local and replace it with a redacted or generated asset.
