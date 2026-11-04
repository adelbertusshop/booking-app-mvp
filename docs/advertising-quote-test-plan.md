# LUMAR advertising quote endpoint — verification plan

Scope: `POST /api/advertising/quote` on `feature/lumar-advertising-plan` only.

This endpoint is a public, non-purchasing quote calculator. Every successful response must retain `payable: false` and `taxStatus: "not_configured"` until tax and payment configuration is formally approved. These checks do not authorize live checkout.

## Positive cases

Send JSON with each valid `packageId`, each `clientType` (`salon_w_aplikacji`, `firma_zewnetrzna`) and each duration (7, 30, 90). Verify:
- HTTP 200.
- `amountNetPln` exactly matches `lib/advertising/catalog.ts`.
- `amountNetMinor === amountNetPln * 100`.
- `currency === "PLN"`, `payable === false`, `taxStatus === "not_configured"`.
- `Cache-Control: no-store` is present.
- Changing client-supplied amount/price fields does not change the server-calculated price.

## Negative and boundary cases

| Input | Expected result |
|---|---|
| Invalid JSON or empty body | HTTP 400 |
| `null`, array, string, or numeric JSON top-level value | HTTP 400 |
| Missing or unknown `packageId` | HTTP 400 |
| Unknown `clientType` | HTTP 400 |
| Duration not exactly 7, 30, or 90 as a JSON number | HTTP 400 |
| Declared content length above 4096 bytes | HTTP 413 |
| Actual streamed body above 4096 bytes, including without Content-Length | HTTP 413 |
| Invalid UTF-8 body | HTTP 400 |
| Valid body of at most 4096 bytes | Continue normal validation |

All error responses should include `Cache-Control: no-store`. Oversized streaming bodies must be cancelled without buffering the full body in application memory.

## Browser/Preview smoke check

1. Open the current Vercel Preview for the commit being verified, not the production domain.
2. Open the advertising packages page and change customer type, duration and placement filter.
3. Confirm the displayed price matches the approved catalog matrix for each selection.
4. Confirm the purchase control is disabled and no Stripe Checkout session or order is created.
5. Repeat after every change to the pricing catalog or quote route.

## Stripe test-mode gate (separate workstream)

Before implementing checkout:
- Connect a Stripe test-mode account/context that the Stripe integration can actually query.
- Configure test-only `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` in Vercel Preview; do not copy live secrets to Preview.
- Add the Stripe SDK using the repository's package manager and commit its lockfile.
- Keep checkout unavailable until the server-side order schema and confirmed Supabase project are reviewed.
- Exercise success, cancellation, failed payment, duplicate webhook, out-of-order webhook and invalid signature cases.
- Verify payment alone never activates an ad; moderation approval and activation timestamp are required.

## Evidence and limitations

GitHub Actions lint/build and a Vercel deployment reaching `READY` validate static checks and compilation only. They do not prove that these HTTP cases or Stripe flows have been executed. Record test date, commit SHA, Preview URL, request, status and observed response when manual or automated tests are actually run.
