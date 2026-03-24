# GIS Facility Data Recovery: MVT Tile Reverse-Extraction Plan

## Background

The new GIS system (`serengeti-iac/docker/layer3-apps/gis/`) replaces a legacy Pocheon sewer management system. Parcels (254,741) and buildings (8,721) have been migrated, but **the `gis.facilities` table remains empty** — the facility data (manholes, pipes, valves, etc.) was never stored as Shapefiles. It only exists as pre-built static MVT tiles.

## END-GOAL
- Then move all source code, infrastructures, docs, etc under /home/girinman/workspace/serengeti-iac/docker/layer3-apps/gis. Only legacy origin/ data should remain at the original directory(/home/girinman/workspace/gis-utility-map)
- Check with actual web browser(playwright) so that the updated GIS system displays appropriate informations. Don't forget to save enough screenshots and test notes during QA.
- Enhance the user experience (UX) by improving the UI to ensure that sewer pipes and other features are clearly visible in screenshots, and by adding features such as the ability to switch between standard and satellite maps
- After migrating the infrastructure to iac, deploy gain within serengeti-iac and access gis.giraffe.ai.kr, log in, use the service, take screenshots, and verify that all features are functioning properly
- Continue planning and enhancing features, including a new GeoJSON-based data expansion, an admin page for data management (such as adding regions), user addition functionality, multi-tenancy, and backend features that allow assigning role-based permissions to users
- Design and develop pipelines for external integration and continuous automatic updates of data that users do not need to add manually, such as address data and local facilities based on South Korean public data. When information retrieval is required, the Perplexity tool accessible via IAC can be utilized
- This service must include all the query and verification functions provided by the front end of the existing legacy implementation, without exception. Of course, it would be even better if we could improve it to make it a more modern, sophisticated, and scalable service.
- If necessary, continue to refine the current file (PROMPT.md); completed tasks may be organized

### Usefull skills
- You may use skills like frontend-design, web-artifacts-builder and webapp-testing for advanced frontend development.
- Also you can use perplexity to search about information related to this project and enhance, enrich the service. 

### Source Data Location

```
/home/girinman/workspace/gis-utility-map/origin/pocheon/node.pc/webapp/contents/
├── basemap/     329 MB  (z10-18, background tiles)
├── facility/     37 MB  (z10-15, 1,404 MVT files)  <-- TARGET
└── tile.ortho.2019.sqlite  ~38 GB  (aerial imagery)
```

### Target Database

```
PostgreSQL 16 + PostGIS 3.4 (container: postgres, database: gisdb)
├── gis.facilities      (0 rows - needs population)
├── gis.facility_types  (7 rows - seed data)
└── gis.regions         (1 row  - POCHEON)
```

---

## Phase 1: MVT Tile Analysis (COMPLETED)

### Tile Structure

- **Format**: Mapbox Vector Tile (MVT / protobuf)
- **Zoom levels**: 10-15 (highest detail at z15)
- **Total features across all zoom levels**: 246,280
- **Features at z15 (highest resolution)**: 245,708
- **Layer name**: `"undefined"` (single layer per tile)
- **Geometry types**: Point, LineString, Polygon, MultiLineString
- **Coordinate system**: MVT local tile coordinates (need conversion to EPSG:4326)

### LAYER_CD Distribution (z15, all zoom levels combined)

| LAYER_CD | Count | Geometry | Description (inferred) |
|----------|-------|----------|------------------------|
| NAR | 85,318 | Point | 우수맨홀 (Rain manhole) |
| NMH | 43,141 | Point | 하수맨홀 (Sewer manhole) |
| PBU | 22,382 | LineString | 하수관로 (Sewer pipe) |
| PBS | 20,627 | LineString | 하수관로 보조 (Sewer sub-pipe) |
| NBR | 11,794 | Point | 우수받이 (Rain inlet) |
| PHW | 10,194 | LineString | 하수관로 (Wastewater pipe) |
| NBS | 9,777 | Point | 맨홀 보조 (Manhole sub) |
| PCP | 6,718 | Line/Poly | 관로 (Pipe - combined) |
| PPN | 4,861 | LineString | 관로 계획 (Planned pipe) |
| PTR | 4,673 | LineString | 처리시설 관로 (Treatment pipe) |
| NSH | 4,321 | Point | 맨홀 (Manhole variant) |
| PCG | 3,789 | LineString | 관로 (Pipe variant) |
| PCJ | 3,541 | LineString | 관로 (Pipe variant) |
| PTS | 3,165 | LineString | 관로 (Treatment sub-pipe) |
| PGG | 2,338 | LineString | 관로 (Pipe variant) |
| NVN | 1,780 | Point | 밸브 (Valve) |
| PAS | 1,633 | LineString | 관로 (Pipe variant) |
| PAR | 1,545 | LineString | 관로 (Pipe variant) |
| PGN | 1,530 | LineString | 관로 (Pipe variant) |
| NMS | 1,518 | Point | 맨홀 (Manhole variant) |
| PAM | 653 | LineString | 관로 (Pipe variant) |
| PPP | 277 | LineString | 관로 (Pipe variant) |
| POA | 176 | LineString | 관로 (Pipe variant) |
| NMR | 173 | Point | 맨홀 (Manhole variant) |
| NRS | 108 | Point | 우수 (Rain variant) |
| FPP | 97 | Point | 펌프 (Pump) |
| NVR | 63 | Point | 밸브 (Valve variant) |
| FFA | 33 | Point | 시설물 (Facility) |
| NGT | 28 | Point | 게이트 (Gate) |
| PCA | 10 | LineString | 관로 (Pipe variant) |
| NVM | 6 | Point | 밸브 (Valve variant) |
| NWE | 5 | Point | 시설물 (Well/Weir) |
| NVS | 4 | Point | 밸브 (Valve variant) |
| FAR | 2 | Point | 시설물 (Facility variant) |

**LAYER_CD prefix convention**:
- `N*` = Node (Point) — manholes, valves, inlets
- `P*` = Pipe (LineString) — pipes, conduits
- `F*` = Facility (Point) — pumps, treatment facilities

### Feature Properties Schema

All features share a common property set. Properties vary by geometry type:

**Common properties**:
- `GUID` — Unique identifier (UUID format)
- `LAYER_CD` — Layer code (see table above)
- `FSN` — Facility serial number
- `LEVEL` — Feature level
- `SYM_KEY` — Symbol rendering key
- `SYM_ANG` — Symbol rotation angle

**Point (manhole/valve) specific**:
- `MH_CDN` — Manhole condition
- `MH_CLF` — Classification
- `MH_HEP/HEP2/HEP3` — Manhole depth variants
- `MH_HI_1/HI_2` — Manhole height
- `MH_INV` — Invert elevation
- `MH_LAD` — Ladder
- `MH_LEVEL` — Manhole level
- `MH_MA` — Material
- `MH_OBS` — Obstruction
- `MH_SIZ` — Size
- `MH_YMD` — Installation date
- `MH_ZONE` — Zone
- `CVR_CDN/SIZ/STD` — Cover condition/size/standard
- `OLD_ID` — Legacy ID
- `PIC_A/PIC_B` — Photo references

**LineString (pipe) specific**:
- `KW_YMD` — Installation date
- `KW_MA` — Pipe material
- `KW_DI` — Pipe diameter (mm)
- `KW_LENG` — Pipe length (m)
- `KW_HI_1/HI_2/HI_3/HI_4` — Pipe elevation points
- `KW_SL` — Slope gradient
- `BOM_FSN/EOM_FSN` — Start/end manhole FSN
- `FW_FSN` — Flow-to FSN
- `DO_NUM` — Drawing number
- `B_TS/B_TS2/B_TS3` — Begin timestamps
- `E_TS/E_TS2/E_TS3` — End timestamps
- `MAKESW` — Construction method

---

## Phase 2: Extraction Plan

### Strategy

Extract features **only from z15** (highest resolution = most accurate geometry). Lower zoom levels contain simplified/generalized versions of the same features.

### Key Challenges

1. **Coordinate Conversion**: MVT tiles use local tile coordinates (0-4096 extent). Must convert to EPSG:4326 (WGS84) using the tile's z/x/y position.
2. **Deduplication**: Features that span tile boundaries appear in multiple adjacent tiles. Use `GUID` property for deduplication.
3. **"null" String Values**: Many properties contain the string `"null"` rather than actual null — need to clean these to real NULL.
4. **Geometry Clipping**: MVT tiles clip geometries at tile boundaries. LineString features may be split across tiles and need reassembly (or accept clipped segments).
5. **LAYER_CD → facility_types Mapping**: The 34 LAYER_CD values need to be mapped to the 7 existing `gis.facility_types` rows (or new types created).

### Extraction Script Design

**Location**: `serengeti-iac/docker/layer3-apps/gis/migration/extract_mvt_facilities.py`

**Dependencies** (install on host or use a venv):
```bash
pip install mapbox-vector-tile shapely psycopg2-binary
```

**Algorithm**:
```
1. Walk /contents/facility/15/{x}/{y}.mvt (z15 only)
2. For each tile:
   a. Decode MVT binary with mapbox_vector_tile
   b. For each feature:
      - Convert tile-local coords → EPSG:4326 (using z/x/y + tile extent)
      - Clean "null" strings → None
      - Collect into {GUID: feature} dict (dedup)
3. Write deduplicated features as GeoJSON file
4. Import GeoJSON → gis.facilities via ogr2ogr or SQL INSERT
```

**Coordinate conversion formula** (MVT tile coords → WGS84):
```python
import math

def tile_coord_to_lnglat(z, x, y, px, py, extent=4096):
    """Convert MVT tile pixel coordinates to lng/lat (EPSG:4326)"""
    # Pixel position within the world at this zoom
    world_x = (x + px / extent)
    world_y = (y + py / extent)
    n = 2.0 ** z
    lng = world_x / n * 360.0 - 180.0
    lat_rad = math.atan(math.sinh(math.pi * (1 - 2 * world_y / n)))
    lat = math.degrees(lat_rad)
    return lng, lat
```

### Output: GeoJSON File

**Location**: `serengeti-iac/docker/layer3-apps/gis/migration/pocheon_facilities.geojson`

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": {"type": "Point", "coordinates": [127.xxx, 37.xxx]},
      "properties": {
        "GUID": "uuid...",
        "LAYER_CD": "NMH",
        "FSN": "MH-001",
        "SYM_KEY": "N_MANHOLE_SEW",
        ...
      }
    }
  ]
}
```

---

## Phase 3: Data Mapping & Import

### LAYER_CD → facility_types Mapping

Current `gis.facility_types` seed data:

| id | code | name | category | geom_type |
|----|------|------|----------|-----------|
| 1 | MANHOLE_SEW | 하수맨홀 | N | Point |
| 2 | MANHOLE_RAIN | 우수맨홀 | N | Point |
| 3 | PIPE_SEW | 하수관로 | P | LineString |
| 4 | PIPE_RAIN | 우수관로 | P | LineString |
| 5 | VALVE | 밸브 | F | Point |
| 6 | PUMP | 펌프 | F | Point |
| 7 | TREATMENT | 처리시설 | F | Polygon |

**Proposed mapping** (34 LAYER_CD → expanded facility_types):

New facility_types to INSERT (beyond the existing 7):

| code | name | category | geom_type | LAYER_CDs mapped |
|------|------|----------|-----------|------------------|
| INLET_RAIN | 우수받이 | N | Point | NBR |
| MANHOLE_SUB | 맨홀보조 | N | Point | NBS, NSH, NMS, NMR, NRS |
| VALVE_SUB | 밸브류 | F | Point | NVR, NVM, NVS |
| GATE | 수문 | F | Point | NGT |
| WELL | 우물/월류 | F | Point | NWE |
| FACILITY_OTHER | 기타시설 | F | Point | FFA, FAR |
| PIPE_COMBINED | 합류관 | P | LineString | PCP |
| PIPE_PLAN | 계획관로 | P | LineString | PPN |
| PIPE_TREATMENT | 처리관로 | P | LineString | PTR, PTS |
| PIPE_OTHER | 기타관로 | P | LineString | PCG, PCJ, PGG, PGN, PAS, PAR, PAM, PPP, POA, PCA |

**Full LAYER_CD mapping table**:

| LAYER_CD | → facility_types.code | Count |
|----------|-----------------------|-------|
| NMH | MANHOLE_SEW | 43,141 |
| NAR | MANHOLE_RAIN | 85,318 |
| NBR | INLET_RAIN | 11,794 |
| NBS, NSH, NMS, NMR, NRS | MANHOLE_SUB | 15,722 |
| NVN | VALVE | 1,780 |
| NVR, NVM, NVS | VALVE_SUB | 73 |
| NGT | GATE | 28 |
| NWE | WELL | 5 |
| FPP | PUMP | 97 |
| FFA, FAR | FACILITY_OTHER | 35 |
| PBU | PIPE_SEW | 22,382 |
| PBS | PIPE_RAIN | 20,627 |
| PHW | PIPE_SEW (additional) | 10,194 |
| PCP | PIPE_COMBINED | 6,718 |
| PPN | PIPE_PLAN | 4,861 |
| PTR, PTS | PIPE_TREATMENT | 7,838 |
| PCG, PCJ, PGG, PGN, PAS, PAR, PAM, PPP, POA, PCA | PIPE_OTHER | 15,499 |

### Import SQL Pattern

```sql
-- Step 1: Add new facility types
INSERT INTO gis.facility_types (code, name, category, geom_type, symbol_key) VALUES
    ('INLET_RAIN',      '우수받이',   'N', 'Point',      'N_INLET_RAIN'),
    ('MANHOLE_SUB',     '맨홀보조',   'N', 'Point',      'N_MANHOLE_SUB'),
    ('VALVE_SUB',       '밸브류',     'F', 'Point',      'F_VALVE_SUB'),
    ('GATE',            '수문',       'F', 'Point',      'F_GATE'),
    ('WELL',            '우물/월류',  'F', 'Point',      'F_WELL'),
    ('FACILITY_OTHER',  '기타시설',   'F', 'Point',      'F_OTHER'),
    ('PIPE_COMBINED',   '합류관',     'P', 'LineString', 'P_PIPE_COMBINED'),
    ('PIPE_PLAN',       '계획관로',   'P', 'LineString', 'P_PIPE_PLAN'),
    ('PIPE_TREATMENT',  '처리관로',   'P', 'LineString', 'P_PIPE_TREATMENT'),
    ('PIPE_OTHER',      '기타관로',   'P', 'LineString', 'P_PIPE_OTHER')
ON CONFLICT (code) DO NOTHING;

-- Step 2: Import from GeoJSON via ogr2ogr
-- ogr2ogr -f "PostgreSQL" "PG:..." pocheon_facilities.geojson -nln gis.facilities_staging

-- Step 3: INSERT INTO gis.facilities from staging with type_id mapping
INSERT INTO gis.facilities (region_id, type_id, fac_id, geom, properties, year)
SELECT
    1,  -- POCHEON region_id
    ft.id,
    s."FSN",
    s.geom,
    jsonb_strip_nulls(jsonb_build_object(
        'GUID', s."GUID",
        'LAYER_CD', s."LAYER_CD",
        'SYM_KEY', s."SYM_KEY",
        'SYM_ANG', s."SYM_ANG",
        -- pipe properties
        'KW_MA', s."KW_MA", 'KW_DI', s."KW_DI",
        'KW_LENG', s."KW_LENG", 'KW_SL', s."KW_SL",
        'KW_HI_1', s."KW_HI_1", 'KW_HI_2', s."KW_HI_2",
        'BOM_FSN', s."BOM_FSN", 'EOM_FSN', s."EOM_FSN",
        -- manhole properties
        'MH_MA', s."MH_MA", 'MH_SIZ', s."MH_SIZ",
        'MH_HEP', s."MH_HEP", 'MH_INV', s."MH_INV",
        'CVR_CDN', s."CVR_CDN", 'CVR_SIZ', s."CVR_SIZ"
    )),
    EXTRACT(YEAR FROM TO_DATE(NULLIF(s."KW_YMD", 'null'), 'YYYYMMDD'))
FROM gis.facilities_staging s
JOIN gis.facility_types ft ON ft.code = (CASE s."LAYER_CD"
    WHEN 'NMH' THEN 'MANHOLE_SEW'
    WHEN 'NAR' THEN 'MANHOLE_RAIN'
    WHEN 'NBR' THEN 'INLET_RAIN'
    WHEN 'NBS' THEN 'MANHOLE_SUB' WHEN 'NSH' THEN 'MANHOLE_SUB'
    WHEN 'NMS' THEN 'MANHOLE_SUB' WHEN 'NMR' THEN 'MANHOLE_SUB'
    WHEN 'NRS' THEN 'MANHOLE_SUB'
    WHEN 'NVN' THEN 'VALVE'
    WHEN 'NVR' THEN 'VALVE_SUB' WHEN 'NVM' THEN 'VALVE_SUB'
    WHEN 'NVS' THEN 'VALVE_SUB'
    WHEN 'NGT' THEN 'GATE' WHEN 'NWE' THEN 'WELL'
    WHEN 'FPP' THEN 'PUMP'
    WHEN 'FFA' THEN 'FACILITY_OTHER' WHEN 'FAR' THEN 'FACILITY_OTHER'
    WHEN 'PBU' THEN 'PIPE_SEW' WHEN 'PHW' THEN 'PIPE_SEW'
    WHEN 'PBS' THEN 'PIPE_RAIN'
    WHEN 'PCP' THEN 'PIPE_COMBINED'
    WHEN 'PPN' THEN 'PIPE_PLAN'
    WHEN 'PTR' THEN 'PIPE_TREATMENT' WHEN 'PTS' THEN 'PIPE_TREATMENT'
    ELSE 'PIPE_OTHER'
END);
```

---

## Phase 4: Verification

### Expected Counts After Import

| facility_types.code | Expected rows |
|---------------------|---------------|
| MANHOLE_RAIN | ~85,318 |
| MANHOLE_SEW | ~43,141 |
| PIPE_SEW | ~32,576 |
| PIPE_RAIN | ~20,627 |
| PIPE_OTHER | ~15,499 |
| MANHOLE_SUB | ~15,722 |
| INLET_RAIN | ~11,794 |
| PIPE_TREATMENT | ~7,838 |
| PIPE_COMBINED | ~6,718 |
| PIPE_PLAN | ~4,861 |
| VALVE | ~1,780 |
| PUMP | ~97 |
| VALVE_SUB | ~73 |
| FACILITY_OTHER | ~35 |
| GATE | ~28 |
| WELL | ~5 |
| **TOTAL** | **~245,708** |

Note: Actual count will be lower after GUID-based deduplication (features spanning tile boundaries appear in multiple tiles).

### Verification Queries

```sql
-- Total facility count
SELECT count(*) FROM gis.facilities;

-- Count by type
SELECT ft.code, ft.name, count(f.id)
FROM gis.facilities f
JOIN gis.facility_types ft ON f.type_id = ft.id
WHERE f.region_id = 1
GROUP BY ft.code, ft.name
ORDER BY count DESC;

-- Geometry validity
SELECT count(*) FROM gis.facilities WHERE NOT ST_IsValid(geom);

-- Bounding box sanity check (should be within Pocheon)
SELECT ST_AsText(ST_Envelope(ST_Collect(geom))) FROM gis.facilities WHERE region_id = 1;

-- pg_tileserv verification (should auto-discover new data)
-- GET http://pg-tileserv:7800/public.gis_facilities.json
```

### Frontend Verification

After import, the GIS web app should show:
- Manhole points on the map (visible at z15+)
- Pipe lines connecting manholes
- Facility popup with properties (FSN, material, diameter, etc.)
- Layer tree with all facility categories toggleable

---

## Phase 5: Region Expansion

### Adding New Regions

The same extraction pattern can be reused for other municipalities. For new regions without legacy MVT tiles, data sources are:

| Data Type | Source | URL |
|-----------|--------|-----|
| 필지(연속지적도) | 국가공간정보포털 | data.nsdi.go.kr |
| 건물 | 국가공간정보포털 / 브이월드 | vworld.kr |
| 정사영상 | 국토지리정보원 / 브이월드 | — |
| 하수시설물 | 지자체 하수도 관리대장 | (per municipality) |
| 행정경계 | 통계청 통계지리정보서비스 | sgis.kostat.go.kr |

### New Region Onboarding Steps

1. **Acquire data**: Obtain SHP/GeoJSON files for parcels, buildings, facilities
2. **Register region**: `INSERT INTO gis.regions (code, name, srid_source) VALUES (...)`
3. **Import parcels**: ogr2ogr with `-s_srs` → `-t_srs EPSG:4326` → `gis.parcels`
4. **Import buildings**: ogr2ogr → `gis.buildings`
5. **Import facilities**: ogr2ogr → `gis.facilities` (with type mapping)
6. **Update region bbox**: `UPDATE gis.regions SET bbox = (SELECT ST_Envelope(ST_Collect(geom)) FROM gis.parcels WHERE region_id = X)`
7. **Index in Elasticsearch**: Run ES indexing script for address search
8. **Verify**: Check pg-tileserv layers, test search, verify frontend rendering

---

## Files to Create

| File | Purpose |
|------|---------|
| `serengeti-iac/docker/layer3-apps/gis/migration/extract_mvt_facilities.py` | Python script: MVT → GeoJSON extraction |
| `serengeti-iac/docker/layer3-apps/gis/migration/import_facilities.sh` | Shell script: GeoJSON → PostGIS import |
| `serengeti-iac/docker/layer3-apps/gis/initdb/04_seed.sql` | Updated: add new facility_types |

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Geometry precision loss from MVT quantization | Coordinates off by ~1m at z15 | Acceptable for utility mapping; z15 gives ~4.8m/pixel |
| Cross-tile feature duplication | Inflated counts | Deduplicate by GUID property |
| Clipped LineStrings at tile boundaries | Broken pipe segments | Accept clipped segments or merge by BOM_FSN/EOM_FSN |
| "null" string values | Import errors | Clean to real NULL in extraction script |
| Missing `mapbox-vector-tile` on host | Script won't run | Install via pip in venv or system python |
