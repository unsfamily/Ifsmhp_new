# Membership certificate

Approval emails attach two separate PDFs. The Certificate of Membership is painted onto `backend/assets/certificates/ifsmhp-letterhead.pdf`: a header, a blank citation field, a dotted cut line, and a membership card. The handwritten signature stays on the card; the generator covers the director wordmark and adds the round organisation seal. The admission certificate is its own file, painted onto `backend/assets/certificates/ifsmhp-admission-certificate.pdf`.

The holder is taken from the stored profile, never from the request body. An unapproved application cannot receive a certificate (`409`).

## What the generator fills in

- **Citation**, in the blank field: the title "Certificate of Membership", the member's name and designation, the admission paragraphs, then membership number, validity, branch, and the date of admission as the last line. The date is not printed above the title.
- The two long admission paragraphs are justified to both edges. The last line of each stays left aligned. The forum is described as seated at Chennai, India.
- **Header:** the printed plot address is covered and replaced with `Head office: IFSMHP Building 1B, Kannamal Nagar, Chennai, Tamil Nadu, India, PIN - 600044`.
- **Card:** photograph when one is stored, otherwise initials. The photograph has no frame and sits slightly below the printed photo slot. The name shares the left edge of the printed word MEMBER when it fits. Branch, membership number, and validity month follow the printed labels. Membership lasts twelve months from approval, and the card prints that expiry month.
- **Signature:** the printed director wordmark and the word DIRECTOR are covered. The handwritten signature stays. A round seal beside it uses `backend/assets/certificates/ifsmhp-logo.png`. Do not draw a second signature.
- **Admission certificate (separate PDF):** the registered member name, then the professional type on the line under "has been admitted as a". A Student is printed as Student, a Professor as Professor, and the other registration types the same way. The job title and institution stay on the membership certificate. Membership number and the admission date replace the sample lines. The border, watermark, council wording, and Chief Research Officer signature stay on the template. The two open lines use Lato Black Italic from `backend/assets/certificates/Lato-BlackItalic.ttf` (SIL Open Font License, `Lato-OFL.txt`).

Wording lives in `backend/domain/membership-certificate.ts`. Drawing lives in `backend/services/membership-certificate.service.ts` and `backend/services/membership-certificate-document.ts`.

## Layout that later edits must keep

Coordinates are PDF points with the origin at the bottom left, measured on the current letterhead.

- The citation stays below the header rule (about y = 717) and above the dotted cut line (about y = 175).
- Card values sit on the printed label baselines. Move those overlays only when a new letterhead moves the labels, and check a rendered sample before merging.
- `tsc` does not copy assets. At runtime the API reads `backend/assets/certificates/ifsmhp-letterhead.pdf`, `backend/assets/certificates/ifsmhp-logo.png`, `backend/assets/certificates/ifsmhp-admission-certificate.pdf`, and `backend/assets/certificates/Lato-BlackItalic.ttf`. From compiled `dist/services` those paths are `../../assets/certificates/`. On the server they are under `/opt/ifsmhp/backend/assets/certificates/`. Confirm those hashes after a deploy. A missing logo still draws the round seal outline. A missing admission template or font fails the certificate.

## Delivery

- The approval email attaches both PDFs after the approval transaction commits. A mail failure does not undo the Member ID.
- `POST /api/v1/admin/members/:id/resend-approval-email` retries that acknowledgement only when none has been sent.
- `POST /api/v1/admin/members/:id/certificate-email` sends both certificates to one approved member (for someone approved before certificates were attached, or after a portrait was added). It is not a broadcast.
- Do not email already-approved members as part of a deploy or a template change.

## Checks

Against local MySQL on port `3308`, never production:

```bash
npm --prefix backend run test -- tests/membership-certificate.test.ts
```

A letterhead-only production release fast-forwards the PDF and the logo, builds the API, and restarts it. Skip `db:deploy` when the pulled commits contain no Prisma migration. Do not republish the frontend unless the registration form also changed. Confirm both server asset hashes match the committed files. Do not generate or send certificates during the deploy.

Reference release: pull request #35, merge `7b3aee3e6e7fbbed59a30b84712e7fd2ee064818`, served by `https://api.ifsmhp.com`.
