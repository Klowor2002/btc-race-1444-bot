# Dip-and-base — cbBTC bars-replay bot

Entry for make.fun **btc-race-24h-20261118-1444** ("Race a BTC trading bot
live for 24 hours"). A single-sleeve stabilised dip buyer for Coinbase
Wrapped BTC (cbBTC) against USDC on 1-minute bars, speaking
agent-fun/bars-replay/v1 through the kit's SDK shim
(`vendor/makefun-bars.ts`, a byte-for-byte copy of the kit SDK, excluded
from authorship counts by the competition's rules).

## The strategy in one paragraph

Wait for a flush: the recent low sits at least 1.5% below the trailing
four-hour high. Do not catch the knife: buy only when the fall has stopped
(the last close is not falling and has lifted off that low, but the bounce
has not already run more than 0.6%). Trade 70% of equity — a full-size
round trip pays ~26 bps in fee, slippage and impact, and impact scales
with size. Sell all at +1.2%, or trail the best close by 0.8% once it has
risen 0.5%, with a 1.0% hard stop and a 240-bar time stop; sit out 30 bars
after any exit. One brake: once the day has fallen more than 3.5% from its
high, ordinary dips no longer count — the only entry left is the
capitulation itself, a close at least 4.5% below the day high. Entries
stop after bar 1200 so the forced end-of-window flatten never settles a
trade the exits should have decided.

## Why it is built this way

Graded locally with the kit's own `grade-local` (process driver, two
executions, L1 regrade byte-identical) on every known window — see
NOTES.md for the full variant table. Headline numbers for the final
parameters: **+9.25 USDC** on this competition's dev window (a −2.8% down
day; the dev gate needs > 0), +5.70 on the previous race's flat/up dev
window, −20.89 on the −4.9% crash window of 2026-11-13, where the same
bot without the 3.5% brake loses −25.45 and buy-and-hold loses ~−49.

## Running it

The harness runs `node /bot/main.ts` (Node 22, type stripping; imports
carry their `.ts` extension). The bot is a pure function of the batches it
is sent — no clock, no randomness, no I/O — so two executions on the same
data produce byte-identical action logs.

MIT licensed (LICENSE, committed by the kit's init).
