# Build notes — btc-race-24h-20261118-1444

## Competition verification (before building)
- competition.yaml: status open, opens 2026-11-18T14:44:00Z, deadline
  2026-11-18T20:44:00Z, reward_usd 250 (places 60/40/30/25/20/15x5).
- Entry fee: NO entry-fee field anywhere in competition.yaml (its fees
  section is the 4 bps trade fee of the replay). Fee = $0/null, matching
  every previous btc-race in this lane. Gate cleared, built.
- Kit init anchor (printed in the building session before any write):
  makefun anchor 69d565bdc2fa94bbc7bfc09fa8ad531ec961ad13 round 34071251.

## This dev window's character (from the kit dataset, 1,440 bars)
Day change -2.80%, range 3.43%, worst drop from the day high 3.24%
(close basis). Fell early, recovered mid-day, slid sideways-down after.
Buy-and-hold scores about -28 here and fails the dev gate; a 4.5%-only
deep-dip bot never trades and also fails it (exactly 0).

## Variants graded (kit grade-local, process driver, worktree; every run
## finished, guardrails met, 0 rejected, L1 regrade byte-identical)
Single-sleeve stabilised dip-buy throughout (dip vs trailing 240-bar
high, entry only once the fall stops; one position; sell-all exits).
Columns: THIS dev (-2.80%) / 0603 dev (+0.49%) / 2314 dev (-4.91% crash).

- A balanced: dip 1.5%, 1 uptick, TP 1.2%, trail 0.8%@+0.5%, stop 1.0%,
  size 70%, no day brake.
  +9.250 (6 tr, DD 0.60%) / +5.697 (4 tr, DD 0.69%) / -25.452 (10 tr, DD 3.08%)
- B deeper: dip 2.0/2.8%, 2 upticks + 0.3% bounce, TP 1.6%, stop 1.2%,
  size 85%, hard brake at 4% day drop.
  +8.588 (4 tr, DD 1.69%) / +7.564 (2 tr, DD 0.53%) / -25.862 (4 tr, DD 2.59%)
- C base ladder: dip ladder 1.8/2.6/3.4% by day drop, 3-close base band.
  -4.879 / +4.021 / -19.843  -> REJECTED: fails this dev gate.
- D = A + washout gate at 2% day drop (past it, only a close >=4.5%
  below the day high may enter).
  -3.419 / +5.697 / +2.396  -> REJECTED: fixes the crash day outright but
  fails this dev gate (this day's living is made at 2-3.2% day drops).
- E FINAL = A + washout gate at 3.5% day drop.
  +9.250 (6 tr, DD 0.60%) / +5.697 (4 tr, DD 0.69%) / -20.892 (8 tr, DD 2.27%)
  On THIS and the 0603 window E's action log is byte-identical to A's
  (their worst day drops, 3.24% and 2.43%, never reach the gate), so the
  dev-gate margin is exactly A's +9.25; on the crash day the gate keeps
  the mid-slide entries out and the capitulation tier earns part of the
  slide back: -20.89 instead of -25.45, with a third less drawdown.

## Choice
E. The dev gate is binary and mandatory, so the final entry must first
maximise the margin on THIS window (A/E tie at +9.25, the best graded);
between the gate-passing variants, E strictly dominates A (identical on
two windows, better on the crash day) and B has no crash protection at
all. Further tuning on three known days would be overfitting; the
remaining crash-day loss is bounded (DD 2.3% vs the 25% guardrail) and
buy-and-hold loses ~-49 on such a day, while places pay the top net PnLs
whatever their sign.

## Final grade (kit grade-local, process driver, worktree pre-commit)
- net PnL +9.250056 USDC, 6 trades, win rate 0.666666666, max drawdown
  0.5963160%, fees 1.691644 USDC (at 2x fees +7.556499), guardrails met,
  0 rejected. DEV GATE: PASS.
- action_log_sha256 eb0be73c6596b3ab444c752de77f39ff1f28cd285210cf2a6c167586c5f6e608
- result_sha256 72b4e9fcc0dc2bf1d0766913fee07cac783e9ed9448fb0bcc331ba9dd5c65d08
  (worktree; a post-commit re-grade reproduces the PnL and the action
  log, the result hash differs only by the worktree hash. Local node
  v24.22.1 vs server v26.13.1, so the server's result hash will differ.)

## NOT submitted — parent finishes (bundle + submit). Deadline 2026-11-18T20:44:00Z.
