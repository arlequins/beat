# Custom GPT setup for Beat Gourmet

Use this guide only after the production API is reachable through HTTPS. OpenAI
documents Custom GPT Actions as an OpenAPI schema with an authentication
configuration, and recommends testing each operation in the Action Preview.
See [Configuring actions in GPTs](https://help.openai.com/en/articles/9442513)
for the current editor flow.

## Configure the Action

1. Generate a random `BEAT_GOURMET_ACTION_API_KEY` of at least 32 characters and
   store it in the protected API runtime secret.
2. Replace `https://api.example.com` in
   [`gourmet-action.openapi.yaml`](gourmet-action.openapi.yaml) with the exact
   production API origin.
3. In the GPT editor, add an Action, paste the schema, choose **API Key**
   authentication, select **Bearer**, and enter the same key.
4. Test `getGourmetContext`, `createGourmetEntry`, `listGourmetEntries`, and
   `updateGourmetEntry` in Preview. Confirm a repeated create with the same
   `Idempotency-Key` does not create a duplicate.
5. Do not paste the key into GPT instructions, conversation starters, source
   code, screenshots, or repository secrets intended for the web bundle.

## Suggested GPT instructions

```text
You help the user keep a private-to-public personal meal log in Beat Gourmet.

Before a meal, call getGourmetContext when prior preferences would improve the
recommendation. Do not claim that a place, ingredient, or preference exists in
the history unless it appears in the Action response.

After a meal, collect restaurant name, menu, date, rating from 0 to 10 in 0.5
steps, revisit intent, and a concise summary. Ask only for useful missing fields.
Show the complete structured record and ask for explicit confirmation before
calling createGourmetEntry. Use a stable unique Idempotency-Key for that one
confirmed message. Never reuse a key for changed content.

After saving, report the returned Beat detailUrl. If the user asks to change a
record, load it, include its expectedRevision, show the proposed changes, and
confirm before calling updateGourmetEntry.

Photos are not transferred through this Action. Explain that the text record is
saved now and that a Beat administrator can attach the photo at /admin/. Do not
invent a photo URL or say that the original photo was uploaded.
```

## Photo boundary

ChatGPT supports uploading images and files to a conversation, but the public
Custom GPT documentation does not define a stable generic Action request field
that forwards the original attachment bytes to an arbitrary API. The
[File Uploads FAQ](https://help.openai.com/en/articles/8555545-uploading-images-and-files-in-chatgpt)
describes ChatGPT uploads, not a binary handoff contract for this Action.

Therefore the supported production flow is:

1. ChatGPT can inspect the photo conversationally and save the confirmed text
   record through the Action.
2. The returned detail link opens Beat Gourmet.
3. An administrator logs in at `/admin/`, selects the record, and attaches the
   phone image.
4. The browser removes metadata and optimizes the image; the API stores the
   WebP in the private S3 state bucket.

This boundary avoids depending on an undocumented attachment representation and
keeps image writes behind Beat administrator authentication and the private
state-bucket boundary.
