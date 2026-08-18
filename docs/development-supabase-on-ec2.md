# Development Supabase on EC2

This checkout's Development environment uses a private, self-hosted Supabase
stack on AWS EC2. It is isolated from Production and contains no Production
credentials or client data.

## Deployment

- AWS region: `ap-south-1`
- Instance: `i-065a52a65dd660717` (`t2.medium`, 2 vCPU, 4 GiB RAM)
- Root storage: 20 GiB gp3 plus 2 GiB swap
- Supabase gateway: EC2 loopback only at `127.0.0.1:8000`
- Local Development URL: `http://127.0.0.1:54321` through SSH forwarding
- PostgreSQL is not published on an EC2 host port
- Docker and all nine containers restart automatically
- Payments, external AI, and the Health Coach Copilot remain disabled

The root EBS volume is currently unencrypted. Keep this environment limited to
synthetic Development data. Do not copy Production data or credentials to it.

## First local setup

AWS CLI credentials with EC2 Instance Connect access must already be configured.
From the repository root, run:

```bash
./scripts/setup-dev-supabase-env.sh
```

This creates the ignored, mode-`600` `.env.development.local` file. It refuses
to overwrite an existing file and transfers only the Development anon and
service-role keys.

## Start Development

Keep the tunnel running in one terminal:

```bash
./scripts/dev-supabase-tunnel.sh
```

Then start the app in a second terminal:

```bash
npm run dev -- --hostname 127.0.0.1
```

The SSH helper resolves the instance's current public IP, uses an ephemeral EC2
Instance Connect key, and verifies the server against its pinned ED25519 host
fingerprint before connecting.

## Synthetic administrator

To display the isolated Development login in your own terminal:

```bash
./scripts/dev-supabase-tunnel.sh --show-login
```

The credential is stored mode `600` on the instance. It is not a Production
credential and must not be reused outside Development.

## Schema

The Development database contains the current application schema, reference
food/dish catalogs, and synthetic users only. Personal historical seed rows were
excluded during provisioning. Apply later forward migrations to Development
before exercising code that depends on them.

`0182_harden_privileged_rpc_acl.sql` explicitly limits billing and payment RPCs
to the service role because self-hosted Supabase default function privileges can
otherwise give the `anon` role an inherited execute grant.

## Current exposure boundary

The stack is intentionally reachable only through SSH. A Vercel Preview cannot
use `127.0.0.1`; connecting a hosted app later requires a stable private network
path or a separately approved HTTPS endpoint and Development-only environment
variables. Do not point Production or the Production Vercel environment at this
database.
