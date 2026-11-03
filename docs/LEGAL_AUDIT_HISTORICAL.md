# AfterList — preliminary legal and provider-compliance review

Reviewed: 2026-11-03, Europe/Berlin. Read-only; no production changes or authenticated user-data tests.

## Verdict and limits

**Not cleared as compliant.** There are verified public-page gaps and provider-attribution concerns, plus unresolved operational questions. This is a practical issue-spotting review, not a legal opinion, regulator decision, penetration test, or assurance that all applicable laws have been checked.

German/EU operation is an explicit working assumption, not established operator information. A .uk domain alone does not establish the operator's jurisdiction. Actual establishment, target audience, monetisation, operator age/capacity, and whether accounts are offered publicly still require confirmation. These facts can change the legal assessment.

## What was actually inspected

- Live https://www.afterlist.uk/ , /privacy, /terms, and /discover through extraction and a real browser.
- /imprint was not retrieved successfully (404); the live footer contains Privacy & Cookies and Terms of Use, but no operator/imprint link. An unlinked page elsewhere cannot be ruled out.
- Browser resource and storage-key inspection on guest pages: TMDB image-host requests, /_vercel/insights/script.js, and guest watchlist localStorage keys were observed. No document-visible cookies were observed in these page visits; that is not proof that no HttpOnly cookies or other storage mechanisms exist elsewhere.
- Read-only local source inspection: feat/systems-upgrade at f6da643b2ad25a09b66ca2df004175bfc386bb69 and cached origin/main at 200392684cd4ac295d296c4395ef32037180408d. Neither ref is assumed to equal production.
- Live deployed entry bundle /assets/index-n4oJWtY0.js contains TMDB /api/search calls and no /api/anilist string. GET /api/anilist?operation=search&q=Frieren returned HTTP 404. This is evidence against assuming that the local AniList feature is currently live, not proof about every deployed route or past processing.

## Priority 1 — public privacy notice is incomplete

**Observed:** the live policy identifies neither a real responsible operator/controller nor a private direct contact. It states purposes but no processing legal bases, and does not state the right to complain to a supervisory authority. It does not explain applicable international-transfer safeguards. Retention of provider logs is described only generically. The policy's rights contact links to public GitHub issues.[13]

**Rule:** GDPR Article 13 requires controller identity/contact, purposes and legal bases, recipients, applicable transfer information, retention period or criteria, and relevant rights, including the right to complain to a supervisory authority. Items such as a data-protection-officer contact apply only where relevant; the law does not require inventing a DPO.[4]

**Assessment:** assuming GDPR applies to this public account service, there are clear disclosure deficiencies in the policy as published. This is not evidence of a data leak. A public GitHub issue is not inherently illegal, but it is a poor primary route for private access/deletion requests and is not an adequate substitute for the missing controller information.

**Action:** establish the actual responsible operator and private contact, then rewrite the notice from the real processing inventory. Explain accounts, guest storage, authentication, analytics, direct artwork requests, and any public-profile or note features actually deployed. Specify justified legal bases rather than labelling everything consent. Do not publish a child's home address or anyone's personal details as an automatic fix; resolve lawful operator/contact arrangements privately first.

Evidence: live /privacy; src/pages/LegalPage.tsx, privacy sections and final contact link on cached main and local HEAD.

## Priority 2 — operator information / Impressum needs resolution

**Observed:** no operator-identification link or complete identity/address was found in the inspected live legal pages/footer. The attempted /imprint route returned 404.

**Rule:** German media regulators explain operator-identification duties under DDG and MStV, including name/address information where required. DDG section 5 specifically covers its defined category of businesslike digital services and includes electronic contact information. Applicability needs an actual scope assessment; free use is not sufficient evidence of exemption.[6][2]

**Assessment:** likely unresolved operator-information risk for a publicly offered multi-user tracker operated from Germany, not a definitive legal ruling. Do not assume that a strictly personal/family exception applies merely because the project is called educational.

**Action:** confirm establishment, audience, operator and business model. If required, supply a reachable Impressum/operator-information page and direct contact using legitimate details. If the operator is under 18, review the operator and hosting/provider arrangements with a parent/guardian or qualified adviser before publishing personal information or entering additional contracts.

## Priority 3 — TMDB attribution appears incomplete (provider terms)

**Observed:** live footer includes the TMDB link and the exact nonendorsement sentence. No TMDB logo appeared in the inspected live home/privacy footer images or SVGs; local footer source also has no logo. This is a positive finding for the sentence, but not full attribution compliance.

**Rule:** TMDB's official FAQ requires its logo plus the notice, an About/Credits-type attribution section, and an approved logo. It describes free use as non-commercial subject to attribution, with commercial licensing handled separately.[8]

**Assessment:** strong provider-attribution gap in the inspected implementation. This is a provider-use/licensing concern, not automatically a finding that a statute has been violated. Seeing posters in an API is also not a blanket guarantee of all third-party copyright permissions; TMDB explicitly says it does not claim ownership of all images/data.[8]

**Action:** add approved TMDB logo and clear credits placement while preserving the existing notice. Check the actual API agreement and any monetisation before claiming the free licence is sufficient. A logo correction alone does not settle every image-rights question.

Evidence: src/components/layout/Footer.tsx lines 25, 33–40 on cached main, corroborated against live DOM.

## Priority 4 — analytics/terminal access needs a real assessment

**Observed:** Vercel's analytics script loads on the live guest privacy and home pages before any consent interaction. Guest browser storage also exists. The privacy notice concludes no banner is needed because there are no optional cookies.[13]

**Rule:** TDDDG section 25 concerns storing or accessing information on a user's terminal, not only cookies. Its exceptions include what is strictly necessary for an expressly requested digital service. Vercel describes cookie-free request-hash-based visitor identification, and warns URLs/events can disclose personal information unless configured appropriately.[7][9]

**Assessment:** the policy's cookie-only reasoning is insufficient. This review does not establish that a consent banner is necessarily required, nor that Vercel Analytics is necessarily unlawful. Strictly necessary watchlist/authentication storage and optional analytics must be evaluated separately. No live analytics payload capture or authenticated-route URL-redaction assessment was performed.

**Action:** inventory analytics payloads and browser/device access, document any GDPR basis and TDDDG analysis, and assess sensitive URLs. If analytics is unnecessary, disabling it is the simplest risk-reduction option, but that change was not performed or authorised by this review.

## Priority 5 — AniList is a release blocker to resolve, not a confirmed live breach

**Observed:** both inspected local refs contain AniList search/discovery/details integration. However, the live AniList endpoint returned 404, and the live entry bundle inspected uses TMDB. No permission from AniList was available for verification.

**Rule:** AniList prohibits API use within competing, non-complementary anime/manga list or tracker services. That restriction explicitly covers both user and media data. Its educational leniency statement is directed to the separate mass-collection rule, not a general waiver of the competition restriction.[1]

**Assessment:** deploying the proposed manga/AniList integration without resolving this would present a serious provider-terms risk. Existing local code should not be confused with production behaviour. I cannot say the live site currently violates this restriction from the observed evidence.

**Action:** obtain written permission or use a provider whose terms permit AfterList's actual use before releasing that integration. Preserve existing user lists if changing providers; do not delete records as a compliance shortcut.

Evidence: src/services/media.ts lines 18–32 and 53–60 on cached main; api/anilist.ts; separate live HTTP/bundle checks above.

## Operational evidence still missing

- Effective provider data-processing agreements, roles and subprocessors: GDPR Article 28 requires appropriate processor arrangements where processing is on the controller's behalf. I did not inspect signed/account-level contracts.[5]
- Transfer locations and valid transfer mechanisms: GDPR Chapter V requirements must be considered for applicable third-country transfers. An EU database region alone does not establish that every provider activity stays in the EU.[12]
- Actual account deletion/access/export fulfilment: cached main exports item JSON and directs account deletion requests to the maintainer; local HEAD adds account-deletion UI/server logic. Neither is proof of live end-to-end deletion or a complete data-subject response. A self-service delete button is not the sole way to meet deletion duties; a real private request process can matter more than button presence.
- Real retention of database rows, uploaded avatars, backups, security/mail logs and offline browser queues.
- Full treatment of minors, age-appropriate notices, any consent-based child-user processing, and operator contractual capacity. Those are fact-dependent; this is not a claim that every account requires parental consent.
- Enforceability of terms (including change-by-continued-use and liability clauses), consumer/commercial duties if monetised, user-generated-content and notice-handling obligations, accessibility applicability, and all intellectual-property permissions were not comprehensively determined.
- No authentication bypass, vulnerability scanning, production database changes, test account creation, real email sending or live account deletion was performed.

## Positives, without overclaiming

The live site has accessible privacy/terms pages and TMDB nonendorsement wording. Inspected source keeps public profiles/private lists private by default and excludes private notes from public projections. Those are useful design choices, but local schema defaults are not proof of the deployed database state or legal compliance.

## Recommended order

1. Confirm Germany/other establishment, actual operator, public audience and revenue model.
2. Resolve operator information/private contact and make the live privacy notice accurate.
3. Complete TMDB attribution and decide whether optional analytics is worth retaining.
4. Verify processor contracts, transfers, retention and real data-subject-request handling.
5. Resolve AniList permission/provider choice before releasing manga integration.

No compliance fixes were deployed. A focused German website/privacy-law review is advisable before calling the public service legally cleared.

## Sources

[1] https://docs.anilist.co/guide/terms-of-use
    > "Use of the AniList API within competing, non-complementary services of the same nature is prohibited."
[2] https://www.gesetze-im-internet.de/ddg/__5.html
    > "Angaben, die eine schnelle elektronische Kontaktaufnahme und eine unmittelbare Kommunikation mit ihnen ermöglichen, einschließlich der Adresse für die elektronische Post,"
[4] https://gdpr-info.eu/art-13-gdpr
    > "the identity and the contact details of the controller and, where applicable, of the controller’s representative;"
[5] https://gdpr-info.eu/art-28-gdpr
    > "Processing by a processor shall be governed by a contract or other legal act under Union or Member State law,"
[6] https://www.die-medienanstalten.de/aufgaben/aufsicht/impressumspflicht
    > "Der Gesetzgeber hat diese Impressumspflicht im"
[7] https://www.gesetze-im-internet.de/ttdsg/__25.html
    > "Die Speicherung von Informationen in der Endeinrichtung des Endnutzers oder der Zugriff auf Informationen, die bereits in der Endeinrichtung gespeichert sind, sind nur zulässig, wenn der Endnutzer auf der Grundlage von klaren und umfassenden Informationen eingewilligt hat."
[8] https://developer.themoviedb.org/docs/faq.md
    > "You shall use the TMDB logo to identify your use of the TMDB APIs."
[9] https://vercel.com/docs/analytics/privacy-policy
    > "Some URLs and query parameters can include sensitive data and personal information"
[12] https://gdpr-info.eu/art-44-gdpr
    > "All provisions in this Chapter shall be applied in order to ensure that the level of protection of natural persons guaranteed by this Regulation is not undermined."
[13] https://www.afterlist.uk/privacy
    > "Because no optional cookies are currently used, AfterList does not show a cookie-consent banner."
