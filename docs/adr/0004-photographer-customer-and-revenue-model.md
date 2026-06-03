# FaceFind's customer is the photographer; the product is their marketing + revenue platform

**Status:** proposed (strategic direction, pre-validation)

FaceFind began framed as an event-photo *distribution* tool with the event Organizer as a vague "buyer". Working through who actually pays, we resolved that the paying customer is the **photographer / Organizer** — the contractor a Host hires — not the Host and not the Guest. The photographer's own goals are (1) win more work and (2) earn more per job, so FaceFind is positioned as a **marketing + revenue platform for photographers**, with face-search distribution as the enabling layer (table stakes), not the value proposition. This is a deliberate departure from the Thai incumbents (SiKram, QPix, Kookoo), which sell themselves as distribution tools.

**Decision:**

- **Customer / revenue source = the photographer** (the Organizer/Tenant account holder). The Host pays the photographer; the Guest is the end user (and, under one model, a buyer).
- Value has two legs: **Marketing** (photographer branding on delivered photos, profile, the share-driven lead loop, future social reels) and **Revenue** (selling photos to Guests, pay-as-you-go).
- Whether photos may be sold is fixed by the **hiring arrangement**, agreed before the shoot (see glossary: *Flat-fee hire* vs *Commission hire*). These map to the per-event `commerce_enabled` flag already staged in the schema.
- **FaceFind's own revenue:**
  - *Flat-fee events:* the per-event activation fee (the 199 / 499 / 999 credit spend).
  - *Commission events:* a **platform fee (%)** on each photo sale (reference: ThaiRun keeps ~20%), with the activation fee reduced or waived.
- **Payout evolves in two stages:**
  - *Stage 1 (manual):* FaceFind takes its fee and produces a per-photographer **sales report** (name + photos sold); the studio settles with photographers off-platform.
  - *Stage 2 (automated):* the account becomes a **Studio that adds photographers as members**; FaceFind collects, deducts its platform fee, and pays each party directly per a studio-configured split (% shares or fixed price per photo).

**Considered and rejected:**

- *Host (event owner) as the direct customer* — bigger budget, but episodic, hard to reach, and not who FaceFind can credibly sell to first. The photographer owns the recurring relationship.
- *Guest-pays marketplace as the primary model (à la ThaiRun)* — proven for speculative/public shoots (running, graduation, concerts) but a two-sided cold-start, and ThaiRun already owns the running niche. Kept as the Revenue leg under *commission hire*, not the foundation.
- *Competing as a cheaper distribution tool* — SiKram/QPix/Kookoo and the India apps already commoditise selfie-search; price is a race to the bottom. FaceFind differentiates on photographer marketing + revenue, Drive-native sourcing, and (unbuilt) social reels.

**Consequences:**

- This **resurrects the Photographer as a first-class entity**. The original `photographers` table was dropped (pivoted to `event_storage_folders`) on the assumption that EXIF/manual attribution sufficed; sales attribution + payout splits make that insufficient again. A member/role model (see ISSUES #B-09 profiles + RBAC) becomes a prerequisite for Stage 2.
- **Stage 2 makes FaceFind a payment facilitator** (collecting Guest money, disbursing to multiple parties). That is a materially larger operational/regulatory lift than the current slip + credit system (payout accounts, KYC, money handling); do not attempt it before the model is validated.
- The direction is **pre-validation**. As of this writing there is zero paid validation and the Thai market is already occupied (SiKram, QPix, Kookoo, ThaiRun). This ADR records the intended direction, not a proven one — revisit after first real revenue.

---

**Update (2026-06-02): first slice shipped, the rest deferred.**

The account-level **special tenant tier** (`tenants.plan = 'business'`) is implemented as a standalone, low-risk step. Its first unlocked feature is **unlimited data retention**: the cleanup-collections cron skips its events, so their face data never expires (see `lib/tenant-plans.ts`, migration `20260602000000_special_tenant_tier`). This needs none of Stage 2.

The **multi-member org** primitive (a Studio with member users + roles, reviving #6 / #B-09) is the shared foundation for BOTH the internal team-archive tool AND the commercial Studio payout model — build it **once, after a concrete use validates it** (real internal adoption, or a paying Studio that needs member payouts), never speculatively. Recorded here so the leverage isn't forgotten; deliberately not built yet.
