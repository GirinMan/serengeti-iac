# Changelog - 2026-03-22

## Summary

Major architectural improvements to make the IaC project flexible and secure:
1. ✅ Migrated blog from WordPress to Astro (static site)
2. ✅ Removed MariaDB (no longer needed)
3. ✅ Identified and documented Nextcloud fix (permission issue)
4. ✅ Created flexible service configuration architecture
5. ✅ Separated sensitive deployment info from infrastructure code

## Commits

### 1. `ac25674` - feat: add flexible service configuration architecture

**Major Feature**: Externalized service configuration

Created a complete system for managing services without hardcoding deployment info in the IaC repository.

**Files Added**:
- `config/README.md` - Comprehensive configuration guide
- `config/services.example.yml` - Service definition template
- `config/npm-hosts.example.yml` - NPM proxy host mapping template
- `config/templates/static-site.yml` - Nginx-based static site template
- `config/templates/webapp.yml` - Web application template (with DB/Redis)
- `config/templates/database.yml` - Database service template
- `scripts/sync-npm-hosts.sh` - NPM configuration sync utility (dry-run mode)
- `docs/SECRET-REPO-SETUP.md` - Complete guide for setting up private secret repository

**Key Concepts**:

1. **Configuration Separation**
   - **Public IaC Repo**: Infrastructure code, templates, examples
   - **Private Secret Repo**: Actual domains, passwords, NPM mappings

2. **Service Addition Workflow**
   ```bash
   # Step 1: Write compose file in IaC repo
   vim docker/layer3-apps/myapp/docker-compose.yml

   # Step 2: Add config in secret repo
   vim ../secrets/config/services.yml     # Service metadata
   vim ../secrets/config/npm-hosts.yml    # NPM mapping
   vim ../secrets/.env                    # Environment variables

   # Step 3: Deploy
   docker compose -f docker/layer3-apps/myapp/docker-compose.yml up -d
   ./scripts/sync-npm-hosts.sh            # Configure NPM
   ```

3. **Benefits**
   - Minimal code changes to add services
   - No sensitive info (domains, mappings) in public repo
   - Declarative NPM configuration (YAML)
   - Environment-specific configs (dev/staging/prod)

**Updated**:
- `AGENTS.md`: Added comprehensive section 4 on flexible configuration
- `.gitignore`: Exclude `config/*.yml` secret files

---

### 2. `bbd8680` - chore: stop WordPress/MariaDB and document Nextcloud fix

**Actions**:
- Stopped `wordpress-blog` and `mariadb` containers
- Identified Nextcloud unhealthy cause: `/mnt/archive/nextcloud` permissions
- Updated `docs/operator-memo.md` with required fixes

**Human Actions Required**:
```bash
# Fix Nextcloud
sudo chown -R 33:33 /mnt/archive/nextcloud
docker restart nextcloud

# Prepare Astro deployment
sudo mkdir -p /mnt/archive/astro-blog/dist
sudo chown -R $USER:$USER /mnt/archive/astro-blog
```

**Runtime Status** (2026-03-22 13:50 UTC):
- ✅ Layer 2 (Data): All healthy
- ✅ Plane: Fully operational
- ⚠️ Nextcloud: Unhealthy (awaiting permission fix)
- ✅ WordPress/MariaDB: Stopped
- ⏳ Astro: Source initialization pending

---

### 3. `d00424d` - refactor: migrate blog from WordPress to Astro static site

**Major Migration**: WordPress → Astro

**Changes**:
- Replaced `wordpress-blog` with `astro-blog` (nginx-based)
- Removed `MariaDB` from Layer 2 data platform
- Created `docker/layer3-apps/blog/`:
  - `docker-compose.yml` - nginx container serving static files
  - `nginx.conf` - optimized caching for static assets
  - `build.sh` - automated build/deploy script
  - `README.md` - complete usage guide

**Architecture Impact**:
- Blog now requires **zero database**
- Storage: `/mnt/archive/astro-blog/dist` (static HTML/CSS/JS)
- NPM mapping: `blog.yourdomain.com` → `astro-blog:80`

**Updated**:
- `AGENTS.md`: WordPress → Astro throughout
- `.env.example`: Removed WordPress/MariaDB variables
- `Makefile`: Removed MariaDB from all targets
- Added `docs/manual/external-setup-template.md` to `.gitignore`

**Benefits**:
- Faster performance (static HTML)
- No database maintenance
- Simpler backup (just `dist/` directory)
- Lower resource usage
- Better security (no server-side vulnerabilities)

---

## Current Infrastructure Status

### Healthy Services ✅
- **Layer 2 Data Platform**:
  - postgres, neo4j, elasticsearch
  - redis, kafka, rabbitmq, minio
- **Layer 3 Apps**:
  - npm (Nginx Proxy Manager)
  - plane-* (full task management stack)
  - backup-pipeline

### Services Needing Attention ⚠️
- **Nextcloud**: Unhealthy (permission fix required)
- **Blog**: WordPress stopped, Astro source pending initialization

### Removed Services ❌
- **wordpress-blog**: Migrated to Astro
- **mariadb**: No longer needed (only supported WordPress)

---

## Next Steps

### Immediate (Human Action Required)

1. **Fix Nextcloud Permissions**
   ```bash
   sudo chown -R 33:33 /mnt/archive/nextcloud
   docker restart nextcloud
   ```

2. **Initialize Astro Blog** (when ready)
   ```bash
   sudo mkdir -p /mnt/archive/astro-blog/dist
   sudo chown -R $USER:$USER /mnt/archive/astro-blog

   cd docker/layer3-apps/blog
   mkdir -p src && cd src
   npm create astro@latest .
   npm install

   # Build and deploy
   cd ..
   bash build.sh
   ```

3. **Set Up Secret Repository** (recommended)
   - Create private GitHub repo: `my-homelab-secrets`
   - Follow guide: `docs/SECRET-REPO-SETUP.md`
   - Move `.env` and deployment configs to secret repo
   - Link files back to IaC repo

### Future Enhancements

1. **NPM API Integration**
   - Implement `sync-npm-hosts.sh --apply` mode
   - Automate proxy host creation from `config/npm-hosts.yml`

2. **Service Templates Expansion**
   - Add templates for common stacks (monitoring, logging, etc.)
   - Create quickstart scripts

3. **Multi-Environment Support**
   - Separate dev/staging/prod configs in secret repo
   - Environment-specific deployment scripts

---

## File Structure Changes

### New Directories
```
config/                          # Service configuration
├── templates/                   # Reusable templates
scripts/                         # Utility scripts
docs/                           # Documentation
└── SECRET-REPO-SETUP.md       # Secret repo guide
```

### Modified Files
- `AGENTS.md` - Added flexible configuration section
- `Makefile` - Removed MariaDB, updated blog paths
- `.env.example` - Removed WordPress/MariaDB variables
- `.gitignore` - Exclude secret config files
- `docs/operator-memo.md` - Updated runtime status

---

## Documentation

- **Configuration Guide**: `config/README.md`
- **Secret Repository Setup**: `docs/SECRET-REPO-SETUP.md`
- **Astro Blog Guide**: `docker/layer3-apps/blog/README.md`
- **Service Templates**: `config/templates/*.yml`
- **Main Architecture**: `AGENTS.md` (CLAUDE.md)

---

## Total Changes Today

- **Commits**: 3
- **Files Added**: 13
- **Files Modified**: 6
- **Files Deleted**: 1
- **Lines Added**: ~1,900
- **Lines Removed**: ~200

---

## Questions Answered

✅ **Q**: How to make IaC flexible so minimal code changes are needed?
**A**: Created config/ directory with externalized service definitions and NPM mappings

✅ **Q**: How to separate sensitive info (domains, mappings)?
**A**: Use separate private GitHub repo for actual configs, keep only templates in IaC repo

✅ **Q**: How to link subdomain via NPM with changing minimum code?
**A**: Declarative `config/npm-hosts.yml` + `sync-npm-hosts.sh` script (future: API automation)

---

**All commits are local. Not pushed to remote yet.**
