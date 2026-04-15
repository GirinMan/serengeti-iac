#!/usr/bin/env python3
# /// script
# requires-python = ">=3.11"
# dependencies = ["httpx", "python-dotenv"]
# ///
"""
setup_npm_hosts.py — Idempotently create/update NPM proxy hosts via API.

Usage:
  uv run scripts/setup_npm_hosts.py                # dry-run
  uv run scripts/setup_npm_hosts.py --apply         # create hosts (HTTP)
  uv run scripts/setup_npm_hosts.py --apply --ssl   # create/update hosts with Let's Encrypt SSL

Required .env variables:
  NPM_ADMIN_EMAIL, NPM_ADMIN_PASSWORD, NPM_ADMIN_PORT,
  CF_BLOG_HOST, CF_PLANE_HOST, CF_NAS_HOST, CF_S3_HOST, CF_MINIO_API_HOST,
  MINIO_API_PORT, MINIO_CONSOLE_PORT
"""

from __future__ import annotations

import os
import sys
import time

import httpx
from dotenv import load_dotenv

load_dotenv()


# ---------------------------------------------------------------------------
# Environment helpers
# ---------------------------------------------------------------------------

def _require(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        sys.exit(f"[ERROR] Required env var '{name}' is not set. Check .env.")
    return value


def _optional(name: str, default: str) -> str:
    value = os.environ.get(name, "").strip()
    return value if value else default


NPM_ADMIN_EMAIL = _require("NPM_ADMIN_EMAIL")
NPM_ADMIN_PASSWORD = _require("NPM_ADMIN_PASSWORD")
NPM_ADMIN_PORT = _optional("NPM_ADMIN_PORT", "81")
NPM_BASE_URL = f"http://localhost:{NPM_ADMIN_PORT}"

# ---------------------------------------------------------------------------
# Host definitions
# ---------------------------------------------------------------------------

PROXY_HOSTS = [
    {
        "name": "Astro Blog",
        "domain_names": [_require("CF_BLOG_HOST")],
        "forward_host": "astro-blog",
        "forward_port": 80,
        "caching_enabled": True,
        "block_exploits": True,
        "allow_websocket_upgrade": False,
        "advanced_config": (
            "location ~* ^/_astro/.*\\.(css|js|jpg|jpeg|png|gif|svg|ico|woff|woff2)$ {\n"
            "    expires 1y;\n"
            "    add_header Cache-Control \"public, immutable\";\n"
            "    access_log off;\n"
            "}"
        ),
    },
    {
        "name": "Plane Tasks",
        "domain_names": [_require("CF_PLANE_HOST")],
        "forward_host": "plane-proxy",
        "forward_port": 80,
        "caching_enabled": False,
        "block_exploits": True,
        "allow_websocket_upgrade": True,
        "advanced_config": (
            "client_max_body_size 50M;\n"
            "proxy_read_timeout 300s;\n"
            "proxy_set_header X-Forwarded-Proto https;"
        ),
    },
    {
        "name": "Nextcloud",
        "domain_names": [_require("CF_NAS_HOST")],
        "forward_host": "nextcloud",
        "forward_port": 80,
        "caching_enabled": False,
        "block_exploits": True,
        "allow_websocket_upgrade": False,
        "advanced_config": (
            "client_max_body_size 512M;\n"
            "proxy_read_timeout 3600s;\n"
            "proxy_send_timeout 3600s;\n"
            "proxy_request_buffering off;\n"
            "proxy_set_header X-Forwarded-Proto https;"
        ),
    },
    {
        "name": "Minio Console",
        "domain_names": [_require("CF_S3_HOST")],
        "forward_host": "minio",
        "forward_port": int(_optional("MINIO_CONSOLE_PORT", "9001")),
        "caching_enabled": False,
        "block_exploits": True,
        "allow_websocket_upgrade": True,
        "advanced_config": "",
    },
    {
        "name": "Minio API",
        "domain_names": [_require("CF_MINIO_API_HOST")],
        "forward_host": "minio",
        "forward_port": int(_optional("MINIO_API_PORT", "9000")),
        "caching_enabled": False,
        "block_exploits": True,
        "allow_websocket_upgrade": True,
        "advanced_config": "",
    },
    {
        "name": "Harbor Registry",
        "domain_names": [_require("CF_HARBOR_HOST")],
        "forward_host": "harbor-nginx",
        "forward_port": 8080,
        "caching_enabled": False,
        # block_exploits off: Harbor's /api/v2.0 and docker registry endpoints
        # trip NPM's exploit rules (e.g. path segments with dots).
        "block_exploits": False,
        "allow_websocket_upgrade": True,
        "advanced_config": (
            "client_max_body_size 0;\n"
            "proxy_read_timeout 900s;\n"
            "proxy_send_timeout 900s;\n"
            "proxy_set_header X-Forwarded-Proto https;\n"
            "proxy_set_header X-Forwarded-Ssl on;"
        ),
    },
]

# ---------------------------------------------------------------------------
# NPM API helpers
# ---------------------------------------------------------------------------


def _headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def npm_get_token(client: httpx.Client) -> str:
    url = f"{NPM_BASE_URL}/api/tokens"
    payload = {"identity": NPM_ADMIN_EMAIL, "secret": NPM_ADMIN_PASSWORD}
    print(f"  Authenticating to NPM at {NPM_BASE_URL} ...")
    try:
        resp = client.post(url, json=payload, timeout=15)
    except httpx.ConnectError as exc:
        sys.exit(
            f"[ERROR] Cannot connect to NPM at {NPM_BASE_URL}.\n"
            f"  Ensure NPM is running. Detail: {exc}"
        )
    if resp.status_code != 200:
        sys.exit(
            f"[ERROR] NPM auth failed — HTTP {resp.status_code}.\n"
            f"  Body: {resp.text[:400]}\n"
            "  Check NPM_ADMIN_EMAIL / NPM_ADMIN_PASSWORD."
        )
    token = resp.json().get("token")
    if not token:
        sys.exit(f"[ERROR] No token in response: {resp.text[:400]}")
    print("  Authentication successful.")
    return token


def npm_list_proxy_hosts(client: httpx.Client, token: str) -> list[dict]:
    url = f"{NPM_BASE_URL}/api/nginx/proxy-hosts"
    resp = client.get(url, headers=_headers(token), timeout=15)
    if not resp.is_success:
        sys.exit(f"[ERROR] Failed to list hosts — HTTP {resp.status_code}: {resp.text[:400]}")
    return resp.json()


def npm_find_host(hosts: list[dict], domain: str) -> dict | None:
    domain_lower = domain.lower()
    for h in hosts:
        if any(d.lower() == domain_lower for d in (h.get("domain_names") or [])):
            return h
    return None


def npm_create_proxy_host(
    client: httpx.Client, token: str, host_def: dict, *, certificate_id: int = 0,
) -> dict:
    url = f"{NPM_BASE_URL}/api/nginx/proxy-hosts"
    payload = _host_payload(host_def, certificate_id)
    resp = client.post(url, json=payload, headers=_headers(token), timeout=15)
    if not resp.is_success:
        sys.exit(
            f"[ERROR] Failed to create '{host_def['name']}' — "
            f"HTTP {resp.status_code}: {resp.text[:600]}"
        )
    return resp.json()


def npm_update_proxy_host(
    client: httpx.Client, token: str, host_id: int, host_def: dict, *, certificate_id: int = 0,
) -> dict:
    url = f"{NPM_BASE_URL}/api/nginx/proxy-hosts/{host_id}"
    payload = _host_payload(host_def, certificate_id)
    resp = client.put(url, json=payload, headers=_headers(token), timeout=15)
    if not resp.is_success:
        sys.exit(
            f"[ERROR] Failed to update '{host_def['name']}' (id={host_id}) — "
            f"HTTP {resp.status_code}: {resp.text[:600]}"
        )
    return resp.json()


def _host_payload(host_def: dict, certificate_id: int) -> dict:
    has_cert = certificate_id > 0
    return {
        "domain_names": host_def["domain_names"],
        "forward_scheme": "http",
        "forward_host": host_def["forward_host"],
        "forward_port": host_def["forward_port"],
        "certificate_id": certificate_id,
        # ssl_forced=False: Cloudflare already forces HTTPS at the edge.
        # Enabling it causes a redirect loop (CF sends HTTP to origin via tunnel).
        "ssl_forced": False,
        "http2_support": has_cert,
        "hsts_enabled": False,
        "hsts_subdomains": False,
        "allow_websocket_upgrade": host_def["allow_websocket_upgrade"],
        "caching_enabled": host_def["caching_enabled"],
        "block_exploits": host_def["block_exploits"],
        "meta": {},
        "advanced_config": host_def.get("advanced_config", ""),
        "locations": [],
    }


# ---------------------------------------------------------------------------
# SSL certificate helpers
# ---------------------------------------------------------------------------

def npm_request_le_cert(
    client: httpx.Client, token: str, domain_names: list[str],
) -> int:
    """Request a Let's Encrypt certificate via NPM API. Returns certificate ID."""
    url = f"{NPM_BASE_URL}/api/nginx/certificates"
    payload = {
        "provider": "letsencrypt",
        "domain_names": domain_names,
        "meta": {
            "letsencrypt_email": NPM_ADMIN_EMAIL,
            "letsencrypt_agree": True,
            "dns_challenge": False,
        },
    }
    print(f"    Requesting Let's Encrypt cert for {domain_names} ...")
    resp = client.post(url, json=payload, headers=_headers(token), timeout=120)
    if not resp.is_success:
        print(
            f"    [WARN] SSL cert request failed — HTTP {resp.status_code}: "
            f"{resp.text[:300]}"
        )
        return 0
    cert = resp.json()
    cert_id = cert.get("id", 0)
    print(f"    Let's Encrypt cert obtained (id={cert_id})")
    return cert_id


def npm_list_certificates(client: httpx.Client, token: str) -> list[dict]:
    url = f"{NPM_BASE_URL}/api/nginx/certificates"
    resp = client.get(url, headers=_headers(token), timeout=15)
    if not resp.is_success:
        return []
    return resp.json()


def find_cert_for_domain(certs: list[dict], domain: str) -> int:
    """Return certificate ID if a valid cert already covers this domain, else 0."""
    domain_lower = domain.lower()
    for c in certs:
        cert_domains = [d.lower() for d in (c.get("domain_names") or [])]
        if domain_lower in cert_domains:
            return c.get("id", 0)
    return 0


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    apply = "--apply" in sys.argv
    ssl = "--ssl" in sys.argv

    print("=" * 60)
    print("NPM Proxy Host Setup")
    print("=" * 60)
    mode = "DRY RUN"
    if apply:
        mode = "APPLY + SSL" if ssl else "APPLY"
    print(f"  Mode: {mode}")
    print(f"  NPM:  {NPM_BASE_URL}")
    print()

    for h in PROXY_HOSTS:
        domain = h["domain_names"][0]
        target = f"{h['forward_host']}:{h['forward_port']}"
        ws = "on" if h["allow_websocket_upgrade"] else "off"
        cache = "on" if h["caching_enabled"] else "off"
        print(f"  [{h['name']}]")
        print(f"    {domain} -> {target}  (ws={ws}, cache={cache})")
        if h.get("advanced_config"):
            print(f"    advanced_config: {len(h['advanced_config'])} chars")

    print()

    if not apply:
        print("  DRY RUN — no changes made.")
        print("  Run with --apply to create hosts, add --ssl for Let's Encrypt.")
        return

    with httpx.Client(follow_redirects=True) as client:
        token = npm_get_token(client)

        print("  Fetching existing proxy hosts ...")
        existing_hosts = npm_list_proxy_hosts(client, token)
        print(f"  Found {len(existing_hosts)} existing host(s).")

        existing_certs: list[dict] = []
        if ssl:
            existing_certs = npm_list_certificates(client, token)
            print(f"  Found {len(existing_certs)} existing certificate(s).")

        print()

        created = 0
        updated = 0
        skipped = 0

        for h in PROXY_HOSTS:
            domain = h["domain_names"][0]
            existing = npm_find_host(existing_hosts, domain)

            # Resolve certificate
            cert_id = 0
            if ssl:
                cert_id = find_cert_for_domain(existing_certs, domain)
                if cert_id == 0:
                    cert_id = npm_request_le_cert(client, token, h["domain_names"])
                    if cert_id > 0:
                        # Refresh cert list for subsequent lookups
                        existing_certs = npm_list_certificates(client, token)
                    else:
                        print(f"    [WARN] Proceeding without SSL for {domain}")
                    # Brief pause between cert requests to avoid rate limiting
                    time.sleep(1)
                else:
                    print(f"    Reusing existing cert (id={cert_id}) for {domain}")

            if existing is not None:
                host_id = existing.get("id")
                adding_ssl = ssl and existing.get("certificate_id", 0) == 0 and cert_id > 0
                fixing_redirect = existing.get("ssl_forced", 0) != 0
                needs_update = adding_ssl or fixing_redirect
                if not needs_update:
                    ssl_status = "ssl=on" if existing.get("certificate_id", 0) > 0 else "ssl=off"
                    print(f"  [SKIP] {h['name']} — '{domain}' already exists (id={host_id}, {ssl_status})")
                    skipped += 1
                    continue

                print(f"  Updating '{h['name']}' (id={host_id}): enabling SSL ...")
                npm_update_proxy_host(client, token, host_id, h, certificate_id=cert_id)
                print(f"  [OK] Updated id={host_id} with SSL (cert={cert_id})")
                updated += 1
            else:
                print(f"  Creating '{h['name']}': {domain} -> {h['forward_host']}:{h['forward_port']} ...")
                result = npm_create_proxy_host(client, token, h, certificate_id=cert_id)
                ssl_info = f", cert={cert_id}" if cert_id else ""
                print(f"  [OK] Created id={result.get('id')}{ssl_info}")
                created += 1

        print()
        print(f"  Done. Created: {created}, Updated: {updated}, Skipped: {skipped}")


if __name__ == "__main__":
    main()
