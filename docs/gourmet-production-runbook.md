# Gourmet 프로덕션 운영 런북

이 런북은 ChatGPT Action으로 저장한 식사 기록과 관리자 사진을 확인할 때
사용한다. AWS 자격 증명을 로컬에서 사용하지 않는다. 모든 AWS 확인은 보호된
GitHub Actions production Environment와 OIDC로 실행한다.

## 배포 후 확인

1. **Production availability monitor**를 수동 실행해 GitHub Pages,
   `/health/live`, `/health/ready`, OIDC discovery/JWKS/CORS, 인증 없는 관리자
   접근 거부, 공개 Gourmet 목록 계약이 모두 정상인지 확인한다.
2. Custom GPT Preview 또는 모바일 ChatGPT에서 최근 맥락을 읽고, 사용자의 명시적
   확인 뒤 한 건을 저장한다. 응답의 `id`, `revision`, `detailUrl`만 기록한다.
3. `https://arlequins.github.io/beat/admin/`에서 Google SSO로 로그인해 같은 기록을
   찾는다.
4. 관리자 화면에서 사진을 선택하고 `S3에 사진 저장`을 실행한다. 화면에 표시된
   이미지 정보와 `revision`을 확인한다.
5. 엔트리를 `published`로 저장한 뒤 `/gourmet/`에서 목록과 사진을 모바일로
   확인한다. 브라우저가 S3 자격 증명을 요청하지 않는지 확인한다.
6. 잘못된 사진은 `사진 분리`로 현재 리비전에서 제거한다. 공개 이미지 URL이
   `404`가 되는지 확인하되, private S3 객체가 남는 것은 정상이다.

사진 바이트는 브라우저에서 WebP로 정규화되고 EXIF가 제거된다. API의 Lambda
역할은 state prefix에 `GetObject`와 `PutObject`만 가지며 `DeleteObject`는
의도적으로 부여하지 않는다. 따라서 이미지 정리는 “기록 메타데이터 분리”와
“S3 객체 삭제”를 같은 동작으로 취급하지 않는다.

## 관찰과 장애 대응

- 시간별 **Production availability monitor**가 웹과 API를 확인하고 실패 시
  열린 GitHub Issue를 하나 만든다. 다음 성공 실행은 같은 열린 Issue에 복구
  실행을 기록하고 닫는다.
- 배포 직후 5xx가 발생하면 **Production API runtime diagnostics**를 실패한
  배포 run ID와 `production` 확인값으로 실행한다. 출력은 지정된 Lambda 로그
  그룹의 redacted 초기화 메시지만 포함하고, 원본 로그를 artifact로 저장하지
  않는다.
- S3 상태 또는 이미지 오류는 request ID, entry ID, deployment SHA와 발생
  시각을 남긴다. 토큰, API key, Secrets Manager 값, GitHub App private key는
  Issue나 PR에 복사하지 않는다.
- 이미지 고아 객체를 자동 삭제하는 작업은 제공하지 않는다. 먼저 보호된
  Actions에서 read-only Inventory 또는 버전 목록으로 실제 고아 여부를
  확인하고, 삭제 권한을 추가하는 변경은 별도 보안 검토와 승인 후에만 한다.

## 안전한 롤백

1. 새 배포와 관리자 쓰기를 중지하고 실패한 diff/deploy run URL을 보존한다.
2. 문제가 된 애플리케이션 커밋을 되돌리는 PR을 만든다. 동일한 `main` SHA에
   대해 **Production infrastructure diff**를 먼저 검토한다.
3. 검토한 SHA를 **Production deployment**의 `reviewed_commit`으로 지정해
   보호된 Environment에서만 배포한다. 로컬 `sst diff`, `sst deploy`, AWS CLI는
   사용하지 않는다.
4. 상태 JSON이 손상된 경우 `Production operations`의
   `recover-state-version`으로 선택한 S3 버전을 `v1/recovery/`에 복사한다.
   live head를 덮어쓰거나 ledger/Object Lock 버전을 삭제하지 않는다.
5. liveness, 대표적인 관리자 조회, 공개 Gourmet 목록·이미지, 모니터 복구를
   확인하고 incident 기록에 영향·원인·배포 SHA·S3 version ID를 남긴다.

## 관련 문서

- [Gourmet 연계 흐름](gourmet-integration-flow.md)
- [Gourmet API와 저장 설계](gourmet.md)
- [Production AWS/SST handoff](production-aws-sst.md)
- [Incident runbook](incident-runbook.md)
