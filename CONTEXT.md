# PixPresent (FaceFind)

Thai event-photo distribution SaaS: organizers index event photos by face; guests find their own photos via selfie. Monetized by a prepaid credit system topped up through bank-transfer slips.

## Language

### Actors

**Super Admin**:
The platform owner (us), who operates the `/admin` console — verifies fallback slips, inspects tenants, and adjusts credit. One identity today.
_Avoid_: Admin (ambiguous), Staff.

**Organizer**:
The human customer who signs up, creates events, and tops up credit. Identified person-first by their own name; may optionally operate under an Organization (studio/brand) name.
_Avoid_: User (reserved for the auth-layer account), Client.

**Tenant**:
The account row that owns an Organizer's identity, billing profile, events, photos, and credit balance. One Tenant per Organizer signup. Use "Tenant" for the data/billing entity, "Organizer" for the person.
_Avoid_: using Tenant and Organizer interchangeably.

**Guest**:
An event attendee who opens a share link and uploads a selfie to find their photos. Never authenticates.

**Display name** (photographer credit):
The public-facing name for an Organizer. Prefers the Organization name when set; otherwise the Organizer's personal name. Shown to Guests during photo search as the photographer's credit.

### Money

**Credit**:
Prepaid unit, 1 credit = 1 THB. Held as a single `credit_balance` per Tenant. Spent to create events; granted by top-up, refund, or adjustment.

**Top-up**:
An Organizer adding credit by transferring money and submitting a bank Slip. Credit lands only after the Slip is approved.

**Slip**:
The image of a bank-transfer receipt an Organizer uploads to claim a Top-up. Verified automatically by SlipOK; manual Super Admin verification is a fallback when SlipOK is unavailable.

**Credit movement** — every change to a balance, one of exactly four kinds (the ledger's vocabulary):
- **Top-up (`topup_slip`)** — credit added from an approved Slip.
- **Event activation (`activate_event`)** — credit deducted when an event is created.
- **Refund (`refund`)** — credit returned when an event is deleted before its first import.
- **Adjustment (`adjustment`)** — a manual change made by a Super Admin for any reason the other three don't cover (e.g. SlipOK approved a wrong amount, goodwill comp). Always attributable to the Super Admin who made it.

**Credit Ledger**:
The append-only record of every Credit movement. The source of truth for audit; balances are derived snapshots.

## Example dialogue

> **Dev:** When a customer's slip is approved, who gets the credit?
> **Domain expert:** The Tenant. The balance lives on the Tenant, not the person — though one Organizer maps to one Tenant today.
> **Dev:** And if SlipOK approves the wrong amount, can we just fix the balance?
> **Domain expert:** Not silently. You make an Adjustment — a Credit movement with reason `adjustment`, attributed to the Super Admin who made it, with a note. The Ledger must explain every baht.
