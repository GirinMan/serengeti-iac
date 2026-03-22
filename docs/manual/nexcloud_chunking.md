Nextcloud은 서버·클라이언트 둘 다에서 청크 크기를 조절할 수 있어서, Cloudflare 100MB 제한에 맞게 “청크당 100MB 미만”으로 설정하면 됩니다. [bbvm](https://bbvm.net/nextcloud-%EB%8C%80%EC%9A%A9%EB%9F%89-%ED%8C%8C%EC%9D%BC-%EC%97%85%EB%A1%9C%EB%93%9C-%EB%8B%A4%EC%9A%B4%EB%A1%9C%EB%93%9C-%ED%95%98%EA%B8%B0/)

## 1. 서버(Nextcloud) 측 max_chunk_size 설정

Nextcloud 서버에서는 `files` 앱의 `max_chunk_size`를 바이트 단위로 설정합니다. [wiki.dhcloud](https://wiki.dhcloud.me/books/on-premise-cloud-service-nextcloud/page/07cdf)

- 기본값: 약 10MB 정도로 청크 업로드. [code-lab](https://www.code-lab.net/?p=22130)
- 관리용 CLI(occ)에서 설정:

```bash
# 예: 90MB로 설정 (Cloudflare 100MB 제한 고려)
# 90 * 1024 * 1024 = 94371840
occ config:app:set files max_chunk_size --value 94371840
```

- 실제 블로그·위키 예시에서는 Cloudflare 무료 요금제 사용자에게 90MB(94371840 바이트)를 권장하고 있습니다. [bbvm](https://bbvm.net/nextcloud-%EB%8C%80%EC%9A%A9%EB%9F%89-%ED%8C%8C%EC%9D%BC-%EC%97%85%EB%A1%9C%EB%93%9C-%EB%8B%A4%EC%9A%B4%EB%A1%9C%EB%93%9C-%ED%95%98%EA%B8%B0/)
- Docker 환경이라면 `docker exec`으로 컨테이너에 들어가 `occ`를 실행하는 식으로 동일하게 설정합니다. [velog](https://velog.io/@ysy3285/Cloud-Nextcloud-%EB%8C%80%EC%9A%A9%EB%9F%89-%ED%8C%8C%EC%9D%BC-%EC%97%85%EB%A1%9C%EB%93%9C-%EC%84%B8%ED%8C%85)

이렇게 하면 Nextcloud가 대용량 파일도 내부적으로 90MB 단위 청크로 쪼개서 처리하므로, 각 HTTP 요청은 Cloudflare의 100MB 제한을 넘지 않습니다. [code-lab](https://www.code-lab.net/?p=22130)

## 2. PHP/Nginx 등의 일반 용량 제한은 충분히 크게

청크를 90MB로 줄이더라도, 전체 업로드를 막는 PHP·웹서버 제한은 그보다 커야 합니다. [ratatou2.tistory](https://ratatou2.tistory.com/263)

- PHP `php.ini` (또는 대응되는 ini):

  - `upload_max_filesize`  
  - `post_max_size`  
  - `memory_limit` (너무 낮지 않게)  

  예: 수 GB 이상 허용 시  
  ```ini
  upload_max_filesize = 51200M
  post_max_size = 51200M
  memory_limit = 3072M
  ```
  같은 식으로 잡는 사례가 많습니다. [wiki.dhcloud](https://wiki.dhcloud.me/books/on-premise-cloud-service-nextcloud/page/07cdf)

- Nginx/리버스 프록시:

  - `client_max_body_size`를 충분히 크게 (예: 수십 GB) 설정. [ratatou2.tistory](https://ratatou2.tistory.com/263)

Cloudflare의 100MB 제한을 맞추는 건 **Nextcloud의 청크 크기**고, PHP/nginx는 전체 파일 크기 한도를 넉넉하게 둬야 전체 업로드가 성공합니다. [velog](https://velog.io/@ysy3285/Cloud-Nextcloud-%EB%8C%80%EC%9A%A9%EB%9F%89-%ED%8C%8C%EC%9D%BC-%EC%97%85%EB%A1%9C%EB%93%9C-%EC%84%B8%ED%8C%85)

## 3. 데스크톱 클라이언트에서 청크 크기 강제 (옵션)

Nextcloud 데스크톱 클라이언트도 자체적인 청크 크기 설정을 지원합니다. [github](https://github.com/nextcloud/desktop/issues/4271)

- 설정 파일:  
  - Linux: `~/.config/Nextcloud/nextcloud.cfg`  
  - Windows: `%APPDATA%\Nextcloud\nextcloud.cfg`  
- `[General]` 섹션에 다음 줄 추가:

```ini
maxChunkSize=90000000  ; 약 90MB
```

- 일부 사용자는 Cloudflare 환경에서 `maxChunkSize=100000000` (100MB) 값으로 업로드가 잘 된다고 보고했고, 안전하게 90MB 정도로 두는 사례도 있습니다. [github](https://github.com/nextcloud/desktop/issues/4271)

이렇게 하면 클라이언트가 업로드할 때도 “한 요청당 최대 90MB”를 유지하므로, 웹 UI가 아니라 데스크톱 앱으로 올릴 때도 Cloudflare 제한을 피할 수 있습니다. [help.nextcloud](https://help.nextcloud.com/t/any-way-to-force-chunking-for-uploads-made-from-the-web-client/151964)

***

정리하면:

1. Nextcloud 서버에서 `occ config:app:set files max_chunk_size --value 94371840`로 약 90MB로 설정.  
2. PHP / 웹서버의 전체 업로드 한도는 그보다 훨씬 크게.  
3. 필요하면 Nextcloud 데스크톱 클라이언트 `maxChunkSize`도 90MB 정도로 맞추기.

이렇게 맞추면 “파일은 수 GB 이상”이라도, Cloudflare Tunnel/프록시를 타면서 각 요청은 100MB를 넘지 않게 만들 수 있습니다. [bbvm](https://bbvm.net/nextcloud-%EB%8C%80%EC%9A%A9%EB%9F%89-%ED%8C%8C%EC%9D%BC-%EC%97%85%EB%A1%9C%EB%93%9C-%EB%8B%A4%EC%9A%B4%EB%A1%9C%EB%93%9C-%ED%95%98%EA%B8%B0/)
