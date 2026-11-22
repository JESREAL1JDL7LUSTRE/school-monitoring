# School Admin Desk data fetching results

The baseline is commit `9d2bef9`. Both builds ran locally in production mode against the same seeded Supabase instance using the demo administrator. Each route has 10 measured hard loads after one warm-up. The final build's rounds also include browser interactions. A visible route-specific element marks readiness. Chrome recorded final response headers, heading visibility, the readiness marker, and encoded document bytes. The p95 is the slowest of 10 samples using nearest rank. The results describe this workstation and fixture.

## Local hard loads

All timings are in milliseconds. The routes listed below completed in both runs.

| Route | Final headers median, before → after | Heading median, before → after | Ready median, before → after | Ready p95, before → after |
| --- | ---: | ---: | ---: | ---: |
| Home | 184 → 50 | 889 → 467 | 914 → 478 | 1,100 → 547 |
| Employees | 170 → 78 | 487 → 534 | 500 → 563 | 1,123 → 618 |
| Inventory overview | 167 → 106 | 391 → 358 | 418 → 385 | 599 → 551 |
| Inventory items | 189 → 102 | 374 → 508 | 406 → 516 | 1,177 → 804 |
| NOSI | 223 → 83 | 703 → 535 | 741 → 560 | 1,567 → 627 |
| 201 report | 155 → 83 | 436 → 334 | 461 → 365 | 1,058 → 515 |
| Audit history | 163 → 103 | 1,108 → 285 | 1,117 → 295 | 2,139 → 522 |
| Calendar | 53 → 90 | 204 → 257 | 226 → 275 | 333 → 336 |
| Forms | 148 → 113 | 297 → 288 | 320 → 304 | 656 → 584 |
| School settings | 142 → 88 | 307 → 294 | 329 → 309 | 699 → 618 |

Audit history's median encoded document size fell from 61,657 to 14,159 bytes. The first audit query reads up to 26 records including the look-ahead row. The Employees and Inventory item queries return up to 25 interactive records. The local medians for both lists rose in this run while their p95s fell. The data fetched by complete print and export flows continues to match their full authorized scope.

## Local interactions

Ten measured passes per interaction used the same browser actions in each build. Calendar requests count only the selected day or destination month.

| Interaction | Median ms, before → after | p95 ms, before → after |
| --- | ---: | ---: |
| Open Employees from Home | 962 → 944 | 1,061 → 1,091 |
| Apply Employees search | 597 → 500 | 858 → 755 |
| Select a day in the loaded month | 394 → 167 | 483 → 207 |
| Open the next Calendar month | 185 → 145 | 282 → 214 |
| Save a NOSI status | 954 → 404 | 1,022 → 962 |

Same-month selection made 10 requests across 10 baseline passes and zero requests across 10 final passes. Opening the next month made one request in every pass on both builds. The NOSI sample measures from clicking Save to the confirmation appearing. It alternated two states on the same existing local demo record and restored its original status.

## Verification

The SQL regressions inserted 2,000 employees with the same sort name and 20,013 ledger lines under synthetic fixtures. They verified directory paging across the 1,000-row API limit, employee facets and bounded first pages, stable audit cursors with tied timestamps, bounded stock-card reads, fractional as-of counts, and one result for a matching inventory document older than the latest 25 global documents. The SQL fixture runs in a rolled-back transaction.

Lint, type checking, and the production build passed. All 10 Vitest tests and 16 Playwright tests passed. The browser checks covered session refresh, sign-out, live role revocation, restricted files, stale checklist writes, inventory posting and returns, a saved print snapshot, Calendar history and event refresh, and complete inventory export across pages. A traced blank-template request returned HTTP 200 after Auth and role checks with zero inventory reads.

The local browser benchmark runs with `node scripts/benchmark-local.mjs http://127.0.0.1:3000 10` against an existing production build. Set `SCHOOL_DESK_TRACE=1` when starting Next.js to log Supabase request operations, durations, HTTP statuses, and response-range row counts when available.

## Hosted comparison

Vercel rejected the stored credential. The Seoul preview canary, hosted traces, and the isolated hosted `getClaims()` comparison remain pending. Region configuration still needs to be tested against matched preview data before production rollout. [Vercel function region configuration](https://vercel.com/docs/functions/configuring-functions/region)
