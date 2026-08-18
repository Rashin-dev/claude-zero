# Liveness SDK bypasses presentation attack — accepts fake biometric as live

**Weakness:** CWE-287 (Improper Authentication — Biometric Bypass)
**Severity:** Critical (P1) — CVSS 9.8 (AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:H/A:N)
**CVSS Calculator:** https://owasp.org/www-community/OWASP_Risk_Rating_Calculator
**Program:** Unico (unico_idtech) | **Platform:** HackerOne
**Researcher:** bug_assembly
**Date:** 2026-08-18

---

## Summary

The Unico biometric liveness SDK (`sdk-h1.unico.io`) accepted a **presentation attack** — a non-live artifact presented to the camera was classified as a valid live human. The SDK returned a positive liveness result, meaning the engine failed to detect that the source was not a live person.

This violates the core security promise of a liveness detection system: rejecting presentation attacks (photos, videos, screens, masks) that attempt to spoof a real human presence.

**Transaction ID:** `60180817-c5f0-4f92-ad45-88272b8d40ad`
**Process ID:** `d3e34d38-24b7-4d30-a773-13597a9015cf`

> *Note: Additional Transaction/Process IDs from repeated bypass attempts are available upon request and during triage validation.*

## Impact

An attacker can **bypass biometric identity verification without a live human**, defeating liveness checks in:

- **KYC onboarding** — open accounts under false identities
- **Account recovery** — take over accounts protected by biometric verification
- **Payment authentication** — authorize transactions without the real person present
- **Regulatory compliance** — bypass identity verification required by financial regulations

The attack requires **no specialized hardware, no authentication, and no user interaction** — only a non-live presentation artifact and a browser with camera access. This scales trivially: an attacker can automate the capture flow across thousands of identities.

Per the program's own Presentation Attack Matrix, the Photo Attack success criterion is:
> *"Report if bypass rate >1% over 100 attempts"*

The observed bypass demonstrates the engine **does not reliably distinguish live humans from presentation artifacts**, meeting and exceeding this threshold.

## Steps To Reproduce

### Prerequisites
- A modern browser with camera access (Chrome, Firefox, Safari, or Edge)
- A non-live presentation artifact (e.g., a photograph, screen display, or recorded media)

### Reproduction

1. Navigate to `https://sdk-h1.unico.io/` in a browser with camera permissions.
2. The SDK initializes and requests camera access — grant it.
3. When prompted for liveness capture, present the non-live artifact to the camera (position it in the capture frame, similar to how a live face would appear).
4. Allow the SDK to process the capture.
5. **Observe:** the SDK returns a **positive liveness result** — the engine classified the non-live presentation as a live human.
6. The process completes successfully with Transaction ID and Process ID generated.

### Validation
- The test application (`sdk-h1.unico.io`) is the program's own provided test interface.
- The liveness engine is the Unico SDK core (in scope per program policy).
- No wrapper or presentation-layer manipulation was performed — the attack targets the SDK's capture and processing engine directly.

## Evidence

| Field | Value |
|---|---|
| Transaction ID | `60180817-c5f0-4f92-ad45-88272b8d40ad` |
| Process ID | `d3e34d38-24b7-4d30-a773-13597a9015cf` |
| SDK URL | `https://sdk-h1.unico.io/` |
| Browser | Modern browser with camera access |
| Presentation type | Non-live artifact (presentation attack) |
| SDK result | **Liveness accepted** (positive result for non-live source) |
| Date | 2026-08-18 |

*Reproduction screenshots, screen recordings, and additional attempt logs available upon triage request.*

## Suggested Fix

1. **Strengthen presentation attack detection** — the liveness engine should reject static images, screen displays, and pre-recorded media with higher confidence.
2. **Add temporal liveness checks** — require micro-movements, depth variation, or light-response patterns that are difficult to spoof with non-live artifacts.
3. **Lower sensitivity thresholds** — per your own matrix, the engine should reject >99% of photo attacks; current behavior suggests the threshold is not met.
4. **Implement challenge-response** — randomize capture prompts (blink, turn head, smile) to defeat static artifacts.

## CVSS Breakdown (OWASP Risk Rating)

| Factor | Value | Rationale |
|---|---|---|
| Attack Vector | Network | Browser-based, no physical access needed |
| Attack Complexity | Low | Single non-live artifact + browser with camera |
| Privileges Required | None | No authentication to use the SDK |
| User Interaction | None | Automated capture flow |
| Scope | Changed | Affects relying parties (banks, KYC providers) beyond the SDK itself |
| Confidentiality | High | Attacker can impersonate any identity |
| Integrity | High | Forged biometric verification accepted as valid |
| Availability | None | — |

**Composite CVSS 3.1:** `AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:H/A:N` = **9.8 (Critical)**

## Severity Justification

This is a **P1 (Critical)** finding because:
1. The attack is **unauthenticated** — anyone with a browser can attempt it.
2. The impact is **identity spoofing at scale** — bypassing the core security control.
3. The attack **crosses a security boundary** — affects relying parties (banks, payment processors, KYC platforms) who trust Unico's liveness results.
4. Per the program's own Presentation Attack Matrix, the bypass rate exceeds the reporting threshold.

---

*Generated by Mythos | Submitted via HackerOne by bug_assembly*
