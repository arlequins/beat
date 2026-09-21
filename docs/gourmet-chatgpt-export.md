# ChatGPT 사진 내보내기 안내

기존 개인용 Chrome ChatGPT 사진 확장 프로그램은 폐기되었습니다. 새 버전의
Beat에는 확장 소스, 브라우저 권한, 자동 패키징이 포함되지 않습니다.

## 지원하는 사진 흐름

ChatGPT 웹에서 Beat Gourmet MCP 커넥터를 사용하면, 사용자가 초안 저장을
확인할 때 대화에 첨부된 사진을 식사 기록과 함께 전달할 수 있습니다. MCP는
사진을 정규화해 private S3에 저장하고 해당 Gourmet 초안에 붙입니다.
관리자는 기존 Beat 관리자 화면에서 초안을 확인하고 공개 여부를 결정합니다.

MCP 앱은 현재 ChatGPT 모바일에서 사용할 수 없습니다. 모바일에서 사진을
기록하려면 기기에 사진을 저장한 뒤 `/admin/`의 기존 사진 선택 기능을
사용하세요. 공식 대화 전체 내보내기를 자동으로 훑거나 게시하는 경로는
제공하지 않습니다.

이미 설치된 Chrome 확장은 `chrome://extensions`에서 제거하세요. 이전 Beat
릴리스의 ZIP은 더 이상 지원되지 않습니다.

관련 문서:

- [Gourmet 기록과 사진 저장](gourmet.md)
- [ChatGPT MCP 연결 설정](gourmet-chatgpt-mcp.md)
