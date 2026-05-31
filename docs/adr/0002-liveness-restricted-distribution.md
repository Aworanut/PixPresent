# Per-event liveness for restricted photo distribution; liveness search also reads `hidden`

**Status:** accepted

Some events require that certain photos reach **only** the person they belong to — e.g. a VIP handover/award ceremony where each handover shot must go solely to its Recipient, not to anyone who can supply that person's face. Plain selfie face-search cannot enforce this: `SearchFacesByImage` only proves "this face resembles a face in the photo", never "the searcher *is* that person", so anyone holding a photo of the Recipient — or of the Presenter, whose face is public and appears across the sensitive shots — could retrieve those photos.

We add an opt-in, **per-event** liveness requirement (a nullable `events` flag, default off, matching the project's pre-staged-column convention). For a liveness-enabled event:

- The guest must pass a live face check (AWS Rekognition Face Liveness). The face search runs with the **reference image returned by the liveness session** — never a guest-supplied file. The upload / pick-a-photo path is removed **at the server**, not merely hidden in the UI (hiding the button alone is theatre — the `searchFaces` action still accepts an arbitrary `File`). If liveness cannot run or does not pass, we **fail closed** (no photos served).
- The **Presenter** (the VIP whose face would otherwise be a universal key to the sensitive subset) is marked using the existing blacklist / "ซ่อนบุคคล" flow, which sets the affected photos to `visibility = 'hidden'`. The Organizer selecting the Presenter's face is what *defines* which photos are protected — the system has no other way to know which shots are sensitive.
- Crucially, on a liveness-enabled event the search reads **`public` + `match_only` + `hidden`**, whereas ordinary (non-liveness) search keeps reading only `public` + `match_only`. So the Presenter's face drops out of ordinary search (those photos are `hidden`), yet the true Recipient still reaches their handover shot through the liveness path. `hidden` photos stay face-indexed in Rekognition, so matching still works.

We keep the existing three `visibility` states (`public` | `match_only` | `hidden`); the only new logic is the per-event flag deciding whether the search path includes `hidden`.

**Considered and rejected:**

- *A fourth `visibility` state (`restricted`)* meaning "hidden from ordinary search but visible to liveness". Rejected as over-engineering — the three existing states plus "liveness reads `hidden`" cover the need with no migration and no new gallery UI. We accept the overload noted below instead.
- *UI-only camera enforcement / accepting impersonation as best-effort.* Rejected for events whose distribution rule is hard: a camera-only UI is bypassable at the API, so it enforces nothing.

**Consequences:**

- On a **liveness-enabled** event, `hidden` no longer means "removed from everyone". It means "out of ordinary search, still reachable via liveness". There is therefore **no hide-based way to fully suppress a photo on such an event** — genuine removal means deleting the photo. This is a deliberate trade (simplicity over a clean fourth state); these events are not broadly published, so the loss is acceptable.
- A future reader who sees liveness search return `hidden` photos will assume it is a bug. It is not — it is this decision.
- The Presenter's *own* live scan could still surface the sensitive subset (only the actual Presenter can, since liveness binds the search to their live face). Acceptable; revisit only if a Presenter must be excluded from their own event.
- The two search paths diverge by exactly this set: ordinary `searchFaces` must keep excluding `hidden`; only the liveness path includes it.
- Practical risk to handle at build time: Thai guests often open links inside the LINE / in-app browser, where the camera (`getUserMedia`) and the liveness flow frequently fail on iOS. Append `openExternalBrowser=1` to liveness-event share links and detect in-app browsers on the guest landing, or fail-closed becomes "many real Recipients cannot view their photos".
