# Suds media storage

The selected priority is low cost as video usage grows. Use a private Cloudflare
R2 bucket for original photos, uploaded clips, and rendered shorts. The storage
adapter supports S3-compatible endpoints, so the app can also use Amazon S3.
Google Workspace can provide an optional export or backup destination later.
The owner confirmed R2 after comparing it with Vercel Blob on the existing Pro
plan. Cloudflare's skills and five MCP servers are installed, and OAuth was
verified as `alex@ahall.tech`. Its API requires R2 dashboard activation before
bucket creation; that activation and the storage connection are pending. Google
Drive remains an optional future export or backup destination.

## Options

| Option | Useful for | Tradeoff |
| --- | --- | --- |
| Cloudflare R2 | Primary photos and videos with frequent previews and downloads | Standard storage costs $0.015 per GB-month; internet egress is free. Storage operations are billed separately with included monthly allowances. Recommended for Suds. |
| Amazon S3 | Teams already using AWS and needing its lifecycle and access tooling | Storage and transfer prices depend on region and access pattern; internet delivery can add transfer charges. The implemented adapter can target an S3 regional endpoint. |
| Vercel Blob | Integration with an existing Vercel deployment | Pro storage is $0.023 per GB-month and uses shared usage credits. Eligible delivery can use Flat Rate CDN; heavy media delivery has eligibility limits. Private proxy delivery and origin transfer can add costs. Requires another adapter. |
| Azure Blob | Keeping media with existing Azure infrastructure | Browser uploads can use scoped, time-limited SAS credentials. Requires an Azure adapter and its account configuration. |
| Google Workspace Drive | Owner exports, an internal media archive, or an optional backup | Uses existing pooled storage but needs Drive authorization, ownership and sharing rules, and quota handling. Requires a Drive adapter; it is not the primary upload or video-delivery path. |

Google Workspace Business Starter includes 30 GB pooled storage per user,
Business Standard 2 TB, and Business Plus 5 TB. The user's edition and remaining
capacity have not been verified. Drive service accounts do not own files or
have their own quota: automated uploads need a shared drive or OAuth access on
behalf of a human user. Workspace storage is separate from Google Cloud Storage.

Illustrative R2 storage-only cost: 100 GB retained for a full month, less the
10 GB monthly Standard allowance, is about $1.35. At 1 TB represented as 1,000
GB, that is about $14.85. These examples exclude operation charges, compute,
editing providers, taxes, and any separately billed services.

At Vercel's listed storage rate, 100 GB averages $2.30/month before the shared Pro
credit, compared with R2's $1.35 after its Standard allowance. The existing Vercel
team is Pro; its shared $20 credit may cover small pilot usage, but media competes
with the other projects' usage. Flat Rate CDN, when enabled and eligible, includes
1 TB transfer and 1 million requests on Pro. Large-scale media delivery that is
the majority of bandwidth is excluded by its eligibility rules. R2 was selected
for the stated priority of low costs as video usage grows.

## Upload and access flow

1. The authenticated business member asks Suds for an upload authorization.
   Suds records the expected type, bytes, owner, purpose, and expiry.
2. The browser uploads directly to a private pending object using a short-lived
   signed URL. Large video bytes do not pass through a Next.js upload handler.
3. Suds checks the stored object's size and magic bytes, then copies the accepted
   version to a different private key. The upload capability cannot overwrite
   the accepted original.
4. The library contains only validated media belonging to that business.
   Marketing approval is explicit and can be revoked.
5. Owners and editing providers receive narrowly scoped read access. Customer
   portals do not inherit owner media-library access.
6. Render state lives in the database. Worker jobs resume after browser closure.
   Completed shorts are retained or served through durable output access.

Configure bucket CORS for the exact Suds origin and PUT/GET/HEAD operations;
never make the original-media bucket public. Configure a bucket lifecycle rule
that removes abandoned objects under `pending/` after one day. Validated originals live under
`business/[businessId]/media/`, and rendered results under `business/[businessId]/renders/`.
The owner can delete uploaded video originals after active edits finish; completed
outputs remain retained. Pilot allowance is 2 GB per business, including originals
and rendered outputs; output archive/deletion management is a follow-up.

Start with
the implemented single PUT and a 50 MB clip limit; resumable multipart upload
is a follow-up for larger clips and unreliable mobile connections.

## References

- [R2 pricing](https://developers.cloudflare.com/r2/pricing/)
- [R2 browser uploads](https://developers.cloudflare.com/r2/objects/upload-objects/)
- [Amazon S3 pricing](https://aws.amazon.com/s3/pricing/)
- [Vercel Blob pricing](https://vercel.com/docs/vercel-blob/usage-and-pricing)
- [Vercel Pro credits](https://vercel.com/docs/plans/pro-plan)
- [Vercel Flat Rate CDN and media eligibility](https://vercel.com/docs/pricing/flat-rate-cdn)
- [Azure browser uploads](https://learn.microsoft.com/en-us/azure/developer/javascript/tutorial/browser-file-upload-azure-storage-blob)
- [Google Workspace plans](https://workspace.google.com/pricing.html?tab=suite)
- [Drive ownership and shared drives](https://developers.google.com/workspace/drive/api/guides/about-shareddrives)
- [Drive API quotas](https://developers.google.com/workspace/drive/api/guides/limits)

Provider facts checked September 30, 2026. Recheck rates before purchasing.
