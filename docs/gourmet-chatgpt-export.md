# ChatGPT 사진을 Beat Gourmet로 한 번에 내보내기

Custom GPT Action은 식사 텍스트를 저장하지만 ChatGPT 대화의 원본 이미지
바이트를 외부 API로 전달하는 공식 계약이 없다. 따라서 사진을 별도로 다시
선택하는 대신, 현재 ChatGPT 웹 페이지에서 사진을 읽어 이미 로그인한 Beat
관리자 세션으로 기존 초안에 연결하는 개인용 Chrome 확장을 사용한다.

확장 소스와 설치 절차는 [`tools/chatgpt-beat-export/`](../tools/chatgpt-beat-export/)
에 있다. `beat-v*` 릴리즈에는 같은 확장의 ZIP과 SHA-256 체크섬도 함께
첨부된다. 상세한 설치·체크섬 검증·사용 경계는
[`gourmet-chatgpt-export-release.md`](./gourmet-chatgpt-export-release.md)에
정리되어 있다. 압축을 풀고 Chrome에서 해당 폴더를 **압축해제된 확장 프로그램**으로
로드하면 된다. 이 경로는 다음 순서로 동작한다.

1. Beat `/admin/`에 Google SSO로 로그인한 탭을 열어 둔다.
2. 사진이 있는 ChatGPT 대화에서 확장 버튼을 누른다.
3. 확장은 현재 페이지의 사용자 메시지와 이미지 묶음을 읽고, 기존 Beat
   `draft` 기록과 식당명·메뉴·요약·평점을 비교해 연결 후보를 만든다.
4. 후보를 확인하거나 바꾼 뒤 한 번에 사진을 연결한다.

사진은 ChatGPT 페이지에서 방향을 보정하고 긴 변 1,600px 이하로 축소한 뒤
WebP로 변환된다. Beat의 기존 관리자 이미지 경로를 사용하므로 EXIF/GPS
메타데이터가 저장되지 않고, S3 원본 버킷은 계속 비공개로 유지된다.

## 보안 경계

- 확장에는 Action API 키, Google 비밀값, 장기 AWS 자격 증명을 넣지 않는다.
- 이미 열린 Beat 관리자 페이지의 짧은 수명 access token을 내보내기 요청 때만
  읽고, 확장 저장소나 로그에 보관하지 않는다.
- 새 기록을 자동 발행하지 않는다. 현재 Beat `draft`에만 사진을 연결한다.
- 한 번의 내보내기는 임의의 클라이언트 요청 ID를 사용한다. API는 대화 내용이나
  이미지 본문을 로그에 남기지 않고, `gourmet.image_attached` 감사 이벤트에
  엔트리·이미지 수·요청 ID만 기록한다.
- ChatGPT 페이지가 노출하지 않는 파일이나 아직 로드하지 않은 이미지는
  내보낼 수 없다.
- 서버가 공유 URL을 스크랩하지 않는다. 따라서 공개 링크에 남은 텍스트와
  첨부 파일을 임의로 수집하는 SSRF/스크래핑 경로가 생기지 않는다.

이 확장은 현재 텍스트 기록 생성 Action을 대체하지 않는다. 이미 저장된 초안에
사진을 연결하는 단계를 한 번의 검토 가능한 내보내기로 합치는 것이 목적이다.

## 실패했을 때

- `Beat 관리자 화면에서 먼저 로그인해 주세요.`: 같은 Chrome 프로필에서
  `https://arlequins.github.io/beat/admin/`를 열고 Google SSO를 완료한다.
- `연결할 Beat 초안이 없습니다.`: Custom GPT Action이나 관리자 화면에서 먼저
  Gourmet 기록을 `draft` 상태로 저장한다.
- 사진이 보이지 않으면 ChatGPT 대화에서 해당 첨부 이미지를 스크롤해 로드한 뒤
  다시 **현재 대화의 사진 찾기**를 누른다.
