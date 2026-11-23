# LUMAR advertising — Preview operations

## Placement map

| Package | Public placement | Surface |
| --- | --- | --- |
| `listing_highlight` | `salon_listing` | `/salony`; matching salon cards are promoted in the list |
| `featured_profile` | `featured_profile` | Matching salon profile for LUMAR advertisers; external advertisers appear as a sponsored catalog card |
| `in_app_banner` | `in_app_banner` | `/salony` catalog banner section |
| `home_screen_banner` | `home_screen_banner` | Homepage banner |
| `sponsored_carousel` | `sponsored_carousel` | Homepage sponsored cards |

All public serving is limited to campaigns with `status=active`, a start time at or before the current time, and an end time in the future. Destination URLs must be HTTPS.

## Creative uploads

- Authenticated server upload only; production checkout/upload remains blocked.
- Supported file formats: JPEG, PNG, WEBP.
- Maximum size: 5 MB.
- The upload endpoint verifies the actual file signature and stores each file under the authenticated user's UUID prefix.
- The storage bucket is public-read so approved creative assets can be rendered; browser clients do not receive upload permission.
- Checkout rejects paths outside the authenticated user's folder and checks that the uploaded object exists.
- The moderator view displays the creative before approval.

## Measurement

The public event endpoint accepts only `impression` and `click` events for a currently active campaign and matching placement. Aggregate counts are exposed to the campaign owner in `/reklamy/zamowienia`.

These are basic event counters, not audited unique-user analytics. They can include repeated impressions from the same visitor and should not be presented as unique reach.

## Campaign lifecycle

- A successful Stripe webhook moves a campaign to `pending_review`; it does not publish automatically.
- Platform moderation approves or rejects the campaign.
- Approval starts the duration clock and sets `starts_at` / `ends_at`.
- Expired active campaigns are never served. Public ad reads and the owner's order-history read reconcile expired statuses opportunistically.
- A guarded daily Vercel cron route also handles scheduled starts and expirations. It requires both `CRON_SECRET` and `LUMAR_ADVERTISING_EXPIRY_ENABLED=true`. The flag should remain unset/false until the operator explicitly enables the lifecycle job in the intended environment.

## Preview / production boundary

The storage bucket and metrics RPC migrations in this feature branch were applied only to the isolated Preview Supabase project `vicfscuointkoksevocs`. Do not apply them to production or merge this branch until the Preview tests and legal/accounting review are complete. Stripe checkout and creative uploads explicitly return unavailable on production deployments.
