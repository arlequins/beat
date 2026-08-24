# ChatGPT 사진 내보내기 안내

기존의 개인용 Chrome ChatGPT 사진 확장 프로그램은 보안·유지보수 경계를
단순하게 유지하기 위해 **폐기되었습니다**. 새 버전의 Beat에는 확장 소스,
브라우저 권한, 자동 패키징이 포함되지 않습니다.

이미 설치한 확장은 제거하세요.

1. Chrome에서 `chrome://extensions`를 엽니다.
2. Beat Gourmet ChatGPT Exporter를 찾아 **Remove**를 누릅니다.
3. 이전 Beat 릴리스에 남아 있는 ZIP은 더 이상 지원하지 않으며, 새 사진을
   자동으로 전송하지 않습니다.

## 지원하는 사진 흐름

- ChatGPT가 확인한 식사 텍스트는 Custom GPT Action 또는 OAuth 보호 MCP
  커넥터로 확인 후 Gourmet 초안에 저장합니다.
- 사진은 ChatGPT에서 대화로 확인한 뒤 기기에 저장하고, Beat 관리자 화면의
  `Gourmet 기록 → 사진 선택`에서 미리 확인한 파일만 업로드합니다.
- 관리자는 업로드 전 브라우저 미리보기로 사진을 확인하고, 위치 정보가 제거된
  WebP만 private S3에 저장합니다.

원본 대화의 첨부 파일을 자동으로 읽거나, ChatGPT 페이지 DOM·브라우저 세션을
읽는 경로는 제공하지 않습니다. 전체 대화 보관이 필요하면 ChatGPT 공식 데이터
내보내기 후 별도의 검토·수동 업로드 절차를 사용하세요.

관련 문서:

- [Gourmet 기록과 수동 사진 업로드](gourmet.md)
- [ChatGPT MCP import](gourmet-chatgpt-mcp.md)
- [Custom GPT 설정](gourmet-custom-gpt.md)
