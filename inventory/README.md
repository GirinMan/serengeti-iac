# Inventory

현재 서버 상태를 수집하고, redaction 후 기록으로 남기기 위한 디렉토리입니다.

- `inventory/scripts/collect_host_state.sh`
  - 현재 호스트의 OS, 디스크, 네트워크, Docker, 주요 서비스 상태를 수집합니다.
- `inventory/raw/`
  - 수집 원본 출력 경로입니다.
  - IP, 디스크 식별자, 마운트 정보가 포함될 수 있으므로 Git에 올리지 않습니다.
- 문서화 원칙
  - 원본 수집 후 민감값을 `<...>` 형태로 마스킹한 내용을 별도 문서로 정리해 커밋합니다.
