# Beat Gourmet ChatGPT exporter

This is a private Chrome Manifest V3 extension for exporting images from the
current ChatGPT conversation to existing Beat Gourmet draft records. It keeps
the existing Beat authentication and image API boundary; it does not contain a
Beat API key or a long-lived token.

## Install for personal use

1. Open Beat Admin at `https://arlequins.github.io/beat/admin/` and sign in.
2. In Chrome, open `chrome://extensions`, enable **Developer mode**, choose
   **Load unpacked**, and select this directory.
   Beat releases also include a versioned ZIP and SHA-256 checksum; extract
   the ZIP first and select the extracted folder.
3. Keep the signed-in Beat Admin tab open. Open the ChatGPT conversation that
   contains the meal photos.
4. Select the **Beat Gourmet export** extension, use **관리자 로그인 상태 확인**
   until the session is ready, choose **현재 대화의 사진 찾기**, review the
   automatic entry matches, and choose **선택한 초안에 연결**.

The extension reads the short-lived access token from the already-open Beat
Admin page only when an export is requested. It keeps the token in memory for
the request and never writes it to extension storage or logs. The image is
decoded in the ChatGPT page, orientation-corrected, resized to a 1,600px long
edge, converted to WebP, and sent to the existing authenticated Beat image
endpoint. The original file and EXIF metadata are not sent.

The matching step is deliberately reviewable: it scores each image-bearing
user message against the restaurant, menu, summary, and rating of existing
draft records. The user can change the target record before upload. It never
publishes a record or creates a new record by itself.

Each export request receives a random client request ID. Beat records only that
ID, the target entry, and the resulting image count in the structured audit log;
conversation text and image bytes are not written to logs.

## Scope and limitations

- The extension only handles images that the active ChatGPT page exposes to the
  browser. It cannot recover an attachment that the page has not loaded or that
  ChatGPT does not expose to the page.
- It is intentionally limited to the production Beat Admin origin, the local
  web origin, and the documented production API origin.
- It does not inspect cookies, the ChatGPT account store, or browser history.
- The existing Beat Admin session must remain open. If the access token expires,
  sign in again and retry.
- The popup reports whether the Admin tab is missing, signed out, stale, or ready;
  it never displays or stores the token itself.
- Repeating an export skips images already attached to the selected draft by the
  same content hash.
