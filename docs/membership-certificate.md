# Membership certificate

Approval emails attach a one-page PDF painted onto `backend/assets/certificates/ifsmhp-letterhead.pdf`. The page is the official letterhead: a header, a blank citation field, a dotted cut line, and a membership card. The Chief Research Officer's signature is already printed on the card.

The holder is taken from the stored profile, never from the request body. An unapproved application cannot receive a certificate (`409`).

## What the generator fills in

- **Citation**, in the blank field: admission date, the title "Certificate of Membership", the member's name and designation, the admission paragraphs, then membership number, date of admission, validity, and branch.
- **Card:** photograph when one is stored, otherwise initials; name; branch; membership number; validity month. Membership lasts twelve months from approval, and the card prints that expiry month.
- The printed header, card labels, address, and signature stay as they are. Do not draw a second signature.

Wording lives in `backend/domain/membership-certificate.ts`. Drawing lives in `backend/services/membership-certificate.service.ts` and `backend/services/membership-certificate-document.ts`.

## Layout that later edits must keep

Coordinates are PDF points with the origin at the bottom left, measured on the current letterhead.

- The citation stays below the header rule (about y = 717) and above the dotted cut line (about y = 175).
- Card values sit on the printed label baselines. Move those overlays only when a new letterhead moves the labels, and check a rendered sample before merging.
- `tsc` does not copy the PDF. At runtime the API reads `backend/assets/certificates/ifsmhp-letterhead.pdf`. From compiled `dist/services` that is `../../assets/certificates/ifsmhp-letterhead.pdf`. On the server the file is `/opt/ifsmhp/backend/assets/certificates/ifsmhp-letterhead.pdf`.

## Delivery

- The approval email attaches the PDF after the approval transaction commits. A mail failure does not undo the Member ID.
- `POST /api/v1/admin/members/:id/resend-approval-email` retries that acknowledgement only when none has been sent.
- `POST /api/v1/admin/members/:id/certificate-email` sends the certificate by itself to one approved member (for someone approved before certificates were attached, or after a portrait was added). It is not a broadcast.
- Do not email already-approved members as part of a deploy or a template change.

## Checks

Against local MySQL on port `3308`, never production:

```bash
npm --prefix backend run test -- tests/membership-certificate.test.ts
```

A letterhead-only production release fast-forwards that PDF, builds the API, and restarts it. Skip `db:deploy` when the pulled commits contain no Prisma migration. Do not republish the frontend. Confirm the server PDF hash matches the committed file. Do not generate or send certificates during the deploy.

Reference release: pull request #35, merge `7b3aee3e6e7fbbed59a30b84712e7fd2ee064818`, served by `https://api.ifsmhp.com`.
