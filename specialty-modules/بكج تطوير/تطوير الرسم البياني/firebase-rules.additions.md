# FIREBASE RULES — ADDITIVE CHANGES ONLY

Merge the two blocks below into the existing `clinics/$clinicId` object in
`firebase-rules.json`, anywhere inside it (e.g. right after the existing
`"specialty_data"` block, since both new nodes are closely related to it).
**Do not replace the file — merge these two keys in.** Nothing else in
the 325-line file changes.

Per argon-governance ("rules before function, tested in isolation before
production"): deploy this to a staging/isolated Firebase project first,
confirm the existing app still boots and the dental chart still
loads/saves, before deploying to the production project.

```json
        /* ════════════════════════════════
         * v2.1 — تخصيص مصطلحات الأسنان لكل طبيب (إضافي)
         * ════════════════════════════════ */
        "doctor_dental_labels": {
          ".indexOn": ["_none_"]
        },

        /* ════════════════════════════════
         * v2.1 — السجل التاريخي لإجراءات الأسنان (إضافي، Append-only)
         * ════════════════════════════════ */
        "specialty_data": {
          ".indexOn": ["specialty"],
          "dental_history_index_note": "__see below, nested under patients/$patientId__"
        }
```

Correction — `dental_history` actually lives under
`patients/$patientId/specialty_data/dental_history`, not directly under
`clinics/$clinicId`, matching how `dental_media` and `treatment_plans`
are already nested (confirmed against `dental_media_module.js` and
`treatment_plan_module.js`). The indexing rule therefore belongs inside
the existing `"patients"` block. Use this instead of the stray
`specialty_data` edit shown above:

```json
        "patients": {
          "$patientId": {

            /* ── (existing patients/$patientId rules, unchanged) ── */

            "specialty_data": {
              "dental_history": {
                ".indexOn": ["toothCode", "procedureCode", "doctorId"],
                "$eventId": {
                  ".write": "auth != null && (
                    root.child('clinic_auth_map/' + auth.uid).val() === $clinicId ||
                    root.child('clinic_auth_map/' + auth.uid).val() === '__SUPER__'
                  ) && !data.exists()",
                  ".validate": "newData.hasChildren(['patientId', 'procedureCode', 'doctorId', 'date']) &&
                    newData.child('patientId').val() === $patientId"
                }
              }
            }
          }
        },

        "doctor_dental_labels": {
          "$doctorId": {
            "$labelType": {
              "$stableKey": {
                ".validate": "newData.isString() && newData.val().length > 0 && newData.val().length <= 120"
              }
            }
          }
        }
```

## What this does and does not enforce — read before deploying

- **Clinic-vs-clinic isolation: enforced correctly.** Both new nodes sit
  under `clinics/$clinicId`, which already requires
  `auth.token.clinicId === $clinicId` (or the equivalent super-admin /
  `clinic_auth_map` check) at the top of the tree. Clinic B structurally
  cannot reach Clinic A's data here, same as every other node in the
  system today.
- **Append-only on `dental_history`: enforced correctly**, but only as
  strongly as the *existing* `audit_logs` / `financial_transactions`
  append-only guards are — see the important caveat below.
- **Doctor-vs-doctor isolation on `doctor_dental_labels`: NOT enforced by
  these rules**, and cannot be, with the auth model this project has
  today. The `.write` permission at `clinics/$clinicId` (checked only by
  `clinicId`, not by which staff member) already grants any authenticated
  staff member of the clinic write access to the whole subtree beneath
  it — Firebase RTDB rules cascade permissively, so a rule written at a
  deeper node (like `$doctorId` here) can *add* validation but cannot
  *revoke* access already granted higher up. The exact same statement is
  already true of the pre-existing `doctor_pricing` node — this patch
  introduces no new gap, it inherits an existing one. **Today, "Doctor A
  can't touch Doctor B's aliases" is enforced only by convention (the UI
  always reads/writes its own `staffId`), exactly like `doctor_pricing`
  already works.** Closing this for real requires adding a per-staff
  custom claim (e.g. `auth.token.staffId`) in `functions/index.js`'s
  claim-sync functions and then writing a rule that compares
  `auth.token.staffId === $doctorId` — a claims-schema change, which is
  its own reviewable, isolation-tested change per governance (this is
  exactly the class of change the `clinic_auth_map` incident lesson
  applies to), not something to fold silently into this patch.
- **The append-only caveat applies here too**, for the same structural
  reason: the blanket `clinics/$clinicId` write permission means the
  `!data.exists()` guard on `dental_history/$eventId` is, today, exactly
  as soft as the identical guard already is on `audit_logs` and
  `financial_transactions` — a well-behaved client (this one) never
  overwrites an existing key, but nothing at the rules layer can
  currently stop a malicious or buggy write from doing so. This is a
  pre-existing, project-wide property, not something introduced here;
  it's flagged so it isn't mistaken for a guarantee this patch newly
  provides.
