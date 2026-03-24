# 05. 사람이 수동으로 수행해야 하는 체크리스트

> Loop 1~20 작업 이력 기반으로 정리. 자동화된 스크립트/코드로 해결할 수 없고 **사람의 판단이나 외부 시스템 접근이 필요한 항목**만 수록.

---

## 1. DNS / SSL / 외부 접근 설정

### 1-1. Cloudflare DNS A 레코드 등록
- **상태**: 미완료 (Loop 15~20 반복 언급)
- **작업 내용**: Cloudflare 대시보드에서 `gis.giraffe.ai.kr` A 레코드를 서버 IP로 추가
- **경로**: Cloudflare Dashboard → DNS → Records → Add Record
- **참고**: Loop 15에서 NPM 프록시 호스트(`gis.giraffe.ai.kr` → `gis-web:80`, host ID: 8)는 이미 생성됨. DNS 미등록으로 Let's Encrypt 인증서 발급 실패 중

### 1-2. Let's Encrypt SSL 인증서 발급 확인
- **상태**: DNS 등록 후 자동 시도 예정
- **작업 내용**: DNS A 레코드 등록 후 NPM(Nginx Proxy Manager)에서 SSL 인증서 자동 발급 확인
- **확인 방법**: NPM 대시보드 → Proxy Hosts → `gis.giraffe.ai.kr` → SSL 상태 확인
- **실패 시**: NPM에서 수동으로 "Force Renew" 클릭 또는 DNS 전파 대기 후 재시도

### 1-3. HTTPS 접속 검증
- **작업 내용**: 브라우저에서 `https://gis.giraffe.ai.kr/` 접근하여 정상 로드 확인
- **체크 항목**:
  - [ ] SSL 인증서 유효 (자물쇠 아이콘)
  - [ ] React SPA 로드 (로그인 화면 표시)
  - [ ] `/api/health` 정상 응답 (`https://gis.giraffe.ai.kr/api/health`)

---

## 2. 서비스 배포 및 기동 검증

### 2-1. 전체 서비스 빌드 및 기동
- **명령어**: `cd ~/workspace/serengeti-iac && make data && make gis`
- **확인 사항**:
  - [ ] 5개 GIS 서비스 모두 healthy: `docker ps --filter name=gis --filter name=pg-`
    - `pg-tileserv` (healthy)
    - `pg-featureserv` (healthy)
    - `gis-api` (healthy)
    - `gis-worker` (healthy)
    - `gis-web` (healthy)
  - [ ] 기존 인프라 서비스(Nextcloud, Plane, Redis 등) 영향 없음 확인

### 2-2. 종합 헬스체크 실행
- **명령어**: `make gis-status`
- **기대 결과**: PASS=15, WARN=0, FAIL=0 (Loop 17 기준)
- **WARN 발생 시**: 해당 서비스 로그 확인 (`docker logs <container_name>`)

### 2-3. API 엔드포인트 수동 검증
브라우저 또는 curl로 직접 호출하여 응답 확인:

| 엔드포인트 | 기대 응답 | 비고 |
|---|---|---|
| `GET /api/health` | `{"status":"ok"}` | 기본 헬스체크 |
| `GET /api/health?detail=true` | `{"status":"ok","checks":{...}}` | DB/Redis/ES 상세 |
| `GET /api/v1/regions/` | 포천시 1건 | Region 목록 |
| `GET /api/v1/layers/?region=4165000000` | 10개 레이어 | Layer 목록 |
| `GET /api/v1/facilities/types` | 7개 유형 | 시설물 유형 |
| `GET /api/v1/search/address?q=포천 일동면` | 검색 결과 | ES nori 검색 |
| `GET /api/v1/search/autocomplete?q=일동` | 자동완성 8건 | ES autocomplete |

### 2-4. 서비스 재빌드 (코드 변경 후)
- **명령어**: `cd ~/workspace/serengeti-iac && make gis` (docker compose up --build)
- **주의**: Loop 16에서 `httpx` 제거, Loop 19에서 `bcrypt==4.0.1` 고정, Loop 20에서 autocomplete 추가 등 미반영 이미지가 실행 중일 수 있음
- **확인**: `docker inspect gis-api | grep Created` 로 이미지 빌드 시간 확인

---

## 3. 레거시 데이터 마이그레이션

### 3-1. 포천시 Shapefile 마이그레이션 (완료)
- **상태**: Loop 15에서 완료
- **결과**: parcels 254,741건, buildings 8,721건

### 3-2. 시설물 데이터 확보 및 마이그레이션
- **상태**: 미완료 (현재 gis.facilities = 0건)
- **문제**: 시설물(맨홀, 관로, 밸브, 펌프, 처리시설) 원본 데이터가 코드베이스에 없음
- **3가지 대안** (Loop 6에서 정리):

| 방안 | 설명 | 난이도 |
|---|---|---|
| A. 레거시 DB 직접 연결 | 포천시 원본 PostgreSQL 9.2 DB에 접속하여 시설물 테이블 덤프 | 중 (DB 접근권한 필요) |
| B. MVT 타일 역추출 | 기존 정적 MVT 타일에서 Feature를 역파싱하여 PostGIS로 임포트 | 상 (tippecanoe-decode 등 필요) |
| C. 원본 SHP 확보 | 시설물 Shapefile 원본을 포천시/용역사로부터 수급 | 하 (파일만 받으면 됨) |

- **결정 필요**: 위 3가지 중 실행 가능한 방안 선택
- **마이그레이션 실행**: 데이터 확보 후 `migrate-legacy.sh` 패턴 참고하여 변환 SQL 작성 → `gis.facilities` 테이블에 INSERT

### 3-3. Elasticsearch 주소 인덱스 재생성 (선택)
- **상태**: Loop 18에서 263,462건 인덱싱 완료
- **재실행 필요 시**: 데이터 변경(추가 마이그레이션) 후
- **명령어**: `bash ~/workspace/serengeti-iac/docker/layer3-apps/gis/migration/10_setup_elasticsearch.sh`

---

## 4. 브라우저 E2E 수동 검증

### 4-1. 인증 흐름
- [ ] `https://gis.giraffe.ai.kr/` 접속 → 로그인 화면 표시
- [ ] 사용자명: `admin`, 비밀번호: `admin1234` 입력 → 로그인 성공
- [ ] 우측 상단 사용자명/역할 표시 확인
- [ ] 로그아웃 버튼 클릭 → 로그인 화면 복귀

### 4-2. 지도 렌더링
- [ ] 로그인 후 MapLibre GL 지도 캔버스 렌더링
- [ ] 포천시 영역으로 자동 fitBounds (지역 선택 드롭다운에 "포천시" 표시)
- [ ] 줌 인/아웃, 패닝 동작 정상
- [ ] NavigationControl(+/- 버튼), ScaleControl(축척바) 표시

### 4-3. 레이어 관리
- [ ] 사이드바 레이어 트리에 카테고리별 그룹 표시 (배경/항공사진/지번/건물/시설물/관로/맨홀)
- [ ] 체크박스 토글 시 해당 레이어 표시/숨김
- [ ] 색상 프리뷰 원 표시
- [ ] 벡터 타일 로드 확인 (pg-tileserv → MapLibre)

### 4-4. 주소 검색
- [ ] 검색바에 "일동면" 입력 → 300ms 후 자동완성 드롭다운 표시 (최대 8건)
- [ ] Enter 키 → 전체 검색 결과 표시 (최대 20건)
- [ ] 검색 결과 클릭 → 해당 위치로 flyTo
- [ ] Escape 키 → 드롭다운 닫기

### 4-5. 시설물 조회
- [ ] 지도에서 시설물 레이어 Feature 클릭 → MapLibre Popup 표시
- [ ] Popup에 기본 정보 미리보기
- [ ] 사이드바 FacilityDetail 패널에 상세 정보 (관리번호, 설치연도, JSONB properties)
- **참고**: 현재 시설물 데이터 0건이므로, 시설물 마이그레이션(3-2) 완료 후 검증 가능

### 4-6. 데이터 업로드 (관리자 전용)
- [ ] 사이드바 하단 "데이터 관리" 섹션 표시 (admin/editor 역할)
- [ ] 관리 패널 열기 → 대상 테이블 선택 (parcels/buildings/facilities)
- [ ] 파일 선택 (SHP, GeoJSON, ZIP, GPKG, CSV, 500MB 이하)
- [ ] 업로드 → MinIO 저장 + Kafka 이벤트 발행 + gis-worker 처리
- [ ] 수집 이력 목록에 상태 배지 (processing → completed/failed)

### 4-7. 반응형 레이아웃
- [ ] 데스크탑(md 이상): 고정 사이드바 + 지도
- [ ] 모바일(md 미만): 사이드바 숨김 + 햄버거 메뉴 → 오버레이 사이드바 + 백드롭

---

## 5. 자동화 테스트 실행

### 5-1. Playwright E2E 테스트
- **사전 조건**: 서비스가 기동 중이어야 함
- **명령어**:
  ```bash
  cd ~/workspace/serengeti-iac/docker/layer3-apps/gis/gis-web
  npx playwright install chromium
  npm run test:e2e
  ```
- **기대 결과**: 13/13 테스트 통과 (Loop 19 기준, 21.6초)
- **테스트 항목**:
  - 인증 3개: 로그인 폼 표시, 실패, 성공
  - 지도 4개: 캔버스 렌더링, 지역 선택, 레이어 트리, 전체 보기
  - 검색 2개: 입력 필드, 검색 결과
  - 관리자 4개: 데이터 관리 패널, 열기/닫기, 사용자 메뉴, 로그아웃
- **UI 모드** (디버깅 시): `npm run test:e2e:ui`
- **리포트 확인**: `npm run test:e2e:report`

### 5-2. GitHub Actions CI 확인
- **트리거 조건**: `docker/layer3-apps/gis/**` 경로 파일 변경 시 자동 실행
- **확인**: GitHub 리포지토리 → Actions 탭 → `GIS CI` 워크플로우
- **8개 job**: api-check, web-build, worker-check, compose-validate, shell-check, sql-check, docker-build, e2e-test
- **실패 시**: 해당 job 로그 확인 후 코드 수정

---

## 6. 신규 지역 추가 시 체크리스트

> Loop 3 (`03_legacy_data_addition_process.md`)에서 정의한 프로세스 기반

### 6-1. 데이터 준비
- [ ] 지번(필지) Shapefile 확보 (EPSG 확인: 5181/5186/4326 등)
- [ ] 건물 Shapefile 확보
- [ ] 시설물 Shapefile 확보 (맨홀, 관로, 밸브 등 유형별)
- [ ] 항공사진/정사영상 확보 (선택)
- [ ] 해당 지역 행정구역 코드(법정동코드) 확인

### 6-2. 인프라 등록
- [ ] `gis.regions` 테이블에 신규 지역 INSERT (bbox, center, zoom_level)
- [ ] `gis.layers` 테이블에 해당 지역 레이어 메타데이터 INSERT

### 6-3. 데이터 임포트
- 방법 A: **관리자 UI 업로드** (권장)
  - [ ] 브라우저 → 관리 패널 → 대상 테이블 선택 → 파일 업로드
  - [ ] gis-worker 자동 처리 (SHP → 스테이징 → gis 스키마)
- 방법 B: **수동 스크립트**
  - [ ] `migrate-legacy.sh` 패턴 참고하여 shp2pgsql 임포트 스크립트 작성
  - [ ] 스테이징 → 변환 SQL 실행

### 6-4. 검색 인덱스 갱신
- [ ] `10_setup_elasticsearch.sh` 재실행 또는 추가 bulk 인덱싱
- [ ] 검색 테스트: 신규 지역 주소로 검색 → 결과 반환 확인

### 6-5. 프론트엔드 검증
- [ ] 지역 선택 드롭다운에 신규 지역 표시
- [ ] 선택 시 해당 지역 bbox로 fitBounds
- [ ] 레이어 트리에 레이어 목록 로드
- [ ] 벡터 타일 렌더링 확인

---

## 7. 운영 / 모니터링

### 7-1. 정기 헬스체크
- **명령어**: `make gis-status`
- **권장 주기**: 1일 1회 또는 장애 의심 시
- **점검 항목**: 컨테이너 상태, API 응답, DB 데이터 건수, 외부 서비스 연결, 타일 캐시, 리소스 사용량

### 7-2. 로그 확인 (장애 시)
```bash
# 서비스별 로그
docker logs gis-api --tail 100
docker logs gis-worker --tail 100
docker logs gis-web --tail 100
docker logs pg-tileserv --tail 100
docker logs pg-featureserv --tail 100

# 전체 GIS 서비스 로그
cd ~/workspace/serengeti-iac && docker compose -f docker/layer3-apps/gis/docker-compose.yml logs --tail 50
```

### 7-3. 타일 캐시 관리
- **캐시 위치**: Docker named volume `tile-cache` (1GB max, 1h inactive 자동 정리)
- **수동 정리**: `docker exec gis-web rm -rf /var/cache/nginx/tiles/*`
- **캐시 적중 확인**: 응답 헤더 `X-Cache-Status: HIT/MISS`

### 7-4. DB 백업
- [ ] gisdb 정기 백업 스크립트 추가 (기존 maindb 백업 파이프라인에 포함)
- **수동 백업**: `docker exec postgres pg_dump -U postgres gisdb > gisdb_backup_$(date +%Y%m%d).sql`

### 7-5. 모니터링 대시보드 구축 (선택)
- **상태**: 미구축
- **작업 내용**:
  - [ ] Grafana + Prometheus 연동
  - [ ] nginx access log 기반 요청 메트릭
  - [ ] pg_tileserv 응답 시간 모니터링
  - [ ] gis-api 엔드포인트별 응답 시간/에러율

---

## 8. 보안

### 8-1. 관리자 비밀번호 변경
- **상태**: 기본 비밀번호 `admin1234` 사용 중 (seed SQL 기준)
- **작업**: 운영 배포 전 반드시 변경
- **방법**: DB 직접 업데이트 또는 비밀번호 변경 UI 구현 후 변경
  ```bash
  # gis-api 컨테이너에서 새 해시 생성
  docker exec gis-api python -c "
  from passlib.context import CryptContext
  pwd = CryptContext(schemes=['bcrypt'])
  print(pwd.hash('새비밀번호'))
  "
  # DB 업데이트
  docker exec postgres psql -U postgres -d gisdb -c \
    "UPDATE auth.users SET password_hash='<생성된해시>' WHERE username='admin';"
  ```

### 8-2. JWT Secret 변경
- **상태**: `.env`의 `GIS_JWT_SECRET` 값이 예시/기본값일 가능성
- **작업**: 운영 배포 전 강력한 랜덤 시크릿으로 변경
  ```bash
  openssl rand -hex 32  # 새 시크릿 생성
  ```
- **수정 위치**: `~/workspace/serengeti-iac/.env` → `GIS_JWT_SECRET=<새값>`

### 8-3. .env 파일 권한
- [ ] `.env` 파일 권한 제한: `chmod 600 .env`
- [ ] Git에 `.env` 미포함 확인 (`.gitignore`에 등록)

---

## 9. 미구현 기능 (향후 사람의 판단 필요)

| 기능 | 설명 | 우선순위 | 비고 |
|---|---|---|---|
| 비밀번호 변경 UI | 사용자가 직접 비밀번호 변경 | 높음 | 현재 DB 직접 수정만 가능 |
| 업로드 진행률 WebSocket | 실시간 처리 상태 알림 | 중 | gis-worker → gis-api WebSocket |
| deck.gl 3D 시각화 | 3D 좌표 기반 시설물 렌더링 | 낮음 | 3D 데이터 확보 시 |
| gis-worker DLQ | Kafka Dead Letter Queue 처리 | 중 | 실패 메시지 재처리 |
| Grafana 대시보드 | 모니터링 시각화 | 중 | Prometheus 연동 필요 |
| 자동완성 하이라이트 | 매칭 텍스트 볼드 처리 | 낮음 | UX 개선 |
| 검색 히스토리 | localStorage 저장 | 낮음 | UX 개선 |
| Neo4j 관로 네트워크 | 관로 흐름 분석 | 낮음 | Loop 4에서 장기 과제로 분류 |

---

## 요약: 즉시 수행 필요 항목 (우선순위 순)

1. **Cloudflare DNS A 레코드 등록** → SSL 인증서 발급 → HTTPS 접속 활성화
2. **관리자 비밀번호 변경** + **JWT Secret 변경** (보안)
3. **서비스 재빌드** (`make gis`) → Loop 16~20 코드 변경 반영
4. **브라우저 E2E 수동 검증** (로그인 → 지도 → 검색 → 레이어 토글)
5. **시설물 데이터 확보 방안 결정** (레거시 DB / MVT 역추출 / 원본 SHP 수급)
6. **gisdb 백업 파이프라인 구축**
