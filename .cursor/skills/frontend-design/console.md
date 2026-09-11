# Product UI brief

User override, Sep 10 2026: **light consumer dashboard**, not a dark ops board.

Look and feel of Uber / modern ride and ops apps: white cards on a pale gray canvas, generous padding, rounded corners, black primary actions, one green for success.

## Product (unchanged)

| App | User | Unmissable thing |
| --- | --- | --- |
| `headcount` | Duty officer | Dialed / reached / **unreached**. Voicemail is unreached. |
| `vouch` | Verifier | Requested vs permitted. Salary history struck through. |

Always visible: budget remaining, kill switch, masked phones, unsupported fields struck through.

## Tokens

| Role | Value |
| --- | --- |
| Canvas | `#f3f3f3` |
| Card | `#ffffff` |
| Ink | `#0d0d0d` |
| Mute | `#5e5e5e` |
| Line | `#ebebeb` |
| Accent | `#0d0d0d` (primary buttons) |
| Safe / reached | `#06c167` |
| Critical | `#de1135` |
| Follow | `#ed6c02` |
| Unaccounted | `#c4841d` |

Type: Plus Jakarta Sans. Tabular numerals on counters. Radius 16px on cards, full pill on buttons. Card padding 24px. Gaps 24px.

## Layout

```
white header: wordmark · nav pills · budget · Kill
pale canvas
  [ dialed ] [ reached ] [ unreached ]     ← three metric cards
  [ Critical ] [ Follow-up ] [ Safe ] [ Unaccounted ]
```

Do not go back to dark WebEOC, hairline duty boards, or Inter.
