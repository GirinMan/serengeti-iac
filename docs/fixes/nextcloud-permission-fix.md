# Nextcloud Permission Fix - 2026-03-22

## Problem

Nextcloud container was **unhealthy** with 503 errors on status.php endpoint.

## Root Cause

Two permission issues:

1. **Data directory** (`/mnt/archive/nextcloud`): Not owned by www-data (uid 33)
2. **Installation directory** (`/var/www/html`): Owned by uid 1000, not www-data

Nextcloud requires www-data ownership for:
- `/var/www/html/config/` - Write access for configuration
- `/var/www/html/apps/` - Write access for app installation
- `/var/www/html/data/` - Write access for user data

## Solution

### Step 1: Fix data directory (host)
```bash
sudo chown -R 33:33 /mnt/archive/nextcloud
```

### Step 2: Fix installation directory (container)
```bash
docker exec nextcloud chown -R www-data:www-data /var/www/html
```

### Step 3: Restart and verify
```bash
docker restart nextcloud
sleep 30
docker ps | grep nextcloud  # Should show "healthy"
docker exec -u 33 nextcloud php occ status
```

## Why This Happened

The compose file mounts two volumes:
```yaml
volumes:
  - ./html:/var/www/html              # Installation files (owned by host user)
  - ${ARCHIVE_STORAGE_ROOT}/nextcloud:/var/www/html/data  # User data
```

When the container first starts, it creates files as the host user (uid 1000), but Apache/PHP runs as www-data (uid 33). This causes permission conflicts.

## Prevention

For new Nextcloud deployments:

1. Pre-create directories with correct ownership:
```bash
mkdir -p docker/layer3-apps/nextcloud/html
sudo chown -R 33:33 docker/layer3-apps/nextcloud/html
sudo chown -R 33:33 /mnt/archive/nextcloud
```

2. Or use a volume instead of bind mount:
```yaml
volumes:
  - nextcloud-html:/var/www/html
  - ${ARCHIVE_STORAGE_ROOT}/nextcloud:/var/www/html/data
```

## Verification

After fix, Nextcloud should:
- ✅ Show as "healthy" in `docker ps`
- ✅ Return 200 on `curl http://nextcloud/status.php`
- ✅ Work with `occ` commands: `docker exec -u 33 nextcloud php occ status`

## Related Issues

- Initial deployment on 2026-03-10: Files created as uid 1000
- Healthcheck failing for 12 days until fix on 2026-03-22
- No data loss - only accessibility issue

## Time to Recover

- Problem identified: 2026-03-22 13:50 UTC
- Investigation: 20 minutes
- Fix applied: 2026-03-22 14:00 UTC
- Verification: Immediate (healthy within 30 seconds)
- **Total downtime**: ~12 days (non-critical, home lab environment)
