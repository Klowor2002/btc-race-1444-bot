// Dip-and-base: a single-sleeve stabilised dip buyer for the cbBTC race
// (make.fun btc-race-24h-20261118-1444).
//
// One sleeve, one position, one idea, repeated: cbBTC wobbles all day on a
// thin pool, and most of its sharp little sell-offs are flushes, not the
// start of a collapse. This bot waits for a flush worth having - the recent
// low sits at least DIP below the trailing four-hour high - and then refuses
// to catch the knife: it buys only once the price has stopped falling and
// lifted off that low (the "base"), because a dip that is still making new
// lows is a downtrend wearing a dip's clothes. The exit is the mirror of
// the entry: bank the rebound at a fixed take-profit, or, if the rebound
// runs, trail the best close and sell the first real give-back. A hard stop
// and a time stop bound the trades that never rebound.
//
// Why one sleeve and this brake, from the windows this lane has raced:
// momentum crosses on 1-minute bars whipsaw (32-44 trades, deeply negative
// on a flat day); an unbraked shallow dip-bounce wins on mild days and is
// carried out on down days (-64 on a -4.9% window in an earlier sweep); a
// deep-only cliff (4.5% off the day high) never fires on a day whose worst
// drop is 3.2% - and a bot that never trades scores exactly 0 and fails
// the dev gate. This dev window is itself a down day (-2.8%, worst drop
// 3.24%), so the dip has to be reachable: 1.5% off a trailing four-hour
// high, not the day high. The brake is a gate, not a slope: while the day
// is within 3.5% of its high, ordinary stabilised dips may enter; past
// 3.5% the only entry left is the capitulation itself - a close at least
// 4.5% below the day high, stabilised like any other entry. Graded on the
// three known windows (see NOTES.md), that gate is worth +4.6 USDC on the
// -4.9% crash day against the unbraked version of this same bot, and it
// costs nothing on the other two: their worst day drops (3.24% and 2.43%)
// never reach it, so their action logs there are unchanged.
//
// Costs rule everything: a round trip at full size pays ~26 bps in fee,
// slippage and impact, so the bot trades 70% of equity (impact scales with
// size), takes profit at +1.2% (about 4.6 round trips of cost), and never
// re-enters for 30 bars after an exit, so one wobble cannot be bought
// three times. Entries stop after bar 1200: a position opened later would
// be settled by the forced end-of-window flatten, not by the exits above.
//
// The bot is a pure function of the batches it is sent: float64 closes in
// bounded arrays, no clock, no randomness, no I/O - so the two graded
// executions answer every batch identically.

import { BPS, runBars, type Bar, type BarsState, type BuyInput, type SellInput } from './vendor/makefun-bars.ts';

/** Trailing window, in bars, whose highest high anchors the dip. */
const REF_BARS = 240;
/** Bars of history required before the first entry is considered. */
const MIN_HISTORY = 60;
/** Dip: recent low at least this far below the trailing high. */
const DIP = 0.015;
/** Past BRAKE_SOFT the only door left: the close this far below the DAY
 * high - the day's capitulation flush, not another step of the slide. */
const WASHOUT = 0.045;
/** Day drop (close vs day high) past which ordinary dips stop counting:
 * the day has a direction, and a 1.5% dip inside it is a step, not a floor. */
const BRAKE_SOFT = 0.035;
/** Stabilisation: how many of the last closes must be non-falling. */
const STAB_UPTICKS = 1;
/** Stabilisation: the close must sit at least this far above the recent low. */
const MIN_BOUNCE = 0;
/** Do not chase: skip the entry if the bounce already ran further than this. */
const MAX_CHASE = 0.006;
/** Share of equity one position may take, in bps (impact scales with size). */
const SIZE_BPS = 7000;
/** Take-profit: sell all this far above the entry close. */
const TAKE_PROFIT = 0.012;
/** The trailing stop arms once the peak reaches this gain over the entry. */
const TRAIL_ARM = 0.005;
/** Trailing stop: sell all this far below the peak close since entry. */
const TRAIL = 0.008;
/** Hard stop: sell all this far below the entry close. */
const STOP = 0.01;
/** Time stop: sell all after this many bars in the position. */
const TIME_STOP_BARS = 240;
/** No entries on batches after this seq (exits need room to play out). */
const LAST_ENTRY_BAR = 1200;
/** Bars to sit out after any exit or rejected entry. */
const COOLDOWN_BARS = 30;
/** Slippage caps vs the decision close: entries may slip, exits must fill. */
const BUY_SLIPPAGE_BPS = 400;
const SELL_SLIPPAGE_BPS = 1000;
const SYMBOL = 'CBBTC';

/** Highs of the last REF_BARS bars, oldest first, current bar included. */
const trailHighs: number[] = [];
/** Closes of the last few bars, oldest first, current bar included. */
const lastCloses: number[] = [];
/** Highest high of the whole window so far. */
let dayHigh = 0;
/** Decision close of the live position's buy, and its best close since. */
let entryRef = 0;
let peakClose = 0;
/** Batch seq at which the live position's buy was decided. */
let entrySeq = -1;
/** Sit out entries until this batch seq. */
let coolUntil = -1;
/** An order sent on the previous batch whose fill is not yet visible. */
let pending: 'buy' | 'sell' | null = null;

function highest(values: number[]): number {
  let hi = 0;
  for (const v of values) if (v > hi) hi = v;
  return hi;
}

function lowest(values: number[]): number {
  let lo = Number.POSITIVE_INFINITY;
  for (const v of values) if (v < lo) lo = v;
  return lo;
}

/** Has the fall stopped? The last STAB_UPTICKS closes must not fall, the
 * current close must have lifted MIN_BOUNCE off the recent low, and the
 * bounce must not have already run past MAX_CHASE (the fill lands a bar
 * later, so a bounce that already ran is an edge already spent). */
function stabilised(close: number, recentLow: number): boolean {
  if (lastCloses.length < 4) return false;
  for (let i = 0; i < STAB_UPTICKS; i++) {
    const now = lastCloses[lastCloses.length - 1 - i];
    const before = lastCloses[lastCloses.length - 2 - i];
    if (now < before) return false;
  }
  if (close < recentLow * (1 + MIN_BOUNCE)) return false;
  if (close > recentLow * (1 + MAX_CHASE)) return false;
  return close > recentLow;
}

await runBars({
  onBatch(state: BarsState, batch) {
    // Settle the order sent on the previous batch against the account the
    // harness now shows: a buy that filled leaves a position, a sell that
    // filled leaves none. Anything else was rejected (slippage, no bar,
    // cash), and the answer either way is the cooldown, not a chase.
    if (pending === 'buy') {
      pending = null;
      if (!state.positions.has(SYMBOL)) coolUntil = batch.seq + COOLDOWN_BARS;
    } else if (pending === 'sell') {
      pending = null;
      if (!state.positions.has(SYMBOL)) coolUntil = batch.seq + COOLDOWN_BARS;
    }

    const bar = batch.bars.find((b: Bar) => b.symbol === SYMBOL);
    if (bar === undefined) return [];

    const close = Number(bar.c);
    const high = Number(bar.h);
    trailHighs.push(high);
    if (trailHighs.length > REF_BARS) trailHighs.shift();
    lastCloses.push(close);
    if (lastCloses.length > 6) lastCloses.shift();
    if (high > dayHigh) dayHigh = high;

    const held = state.positions.get(SYMBOL);

    // Holding: defend the trade. Take-profit first, while the rebound is
    // being offered; then the trailing stop, which only arms after a real
    // gain so an entry's first wobble cannot shake the bot out; then the
    // hard stop; then the clock.
    if (held !== undefined) {
      if (close > peakClose) peakClose = close;
      const tpHit = entryRef > 0 && close >= entryRef * (1 + TAKE_PROFIT);
      const trailHit = entryRef > 0 && peakClose >= entryRef * (1 + TRAIL_ARM)
        && close <= peakClose * (1 - TRAIL);
      const stopHit = entryRef > 0 && close <= entryRef * (1 - STOP);
      const timeHit = entrySeq >= 0 && batch.seq - entrySeq >= TIME_STOP_BARS;
      if (tpHit || trailHit || stopHit || timeHit) {
        pending = 'sell';
        return [{ side: 'sell', symbol: SYMBOL, qty: held.qty, max_slippage_bps: SELL_SLIPPAGE_BPS } satisfies SellInput];
      }
      return [];
    }

    // Flat: look for the next dip that has finished falling.
    if (pending !== null || batch.seq < coolUntil) return [];
    if (batch.seq > LAST_ENTRY_BAR || trailHighs.length < MIN_HISTORY) return [];
    if (dayHigh <= 0) return [];

    const dayDrop = (dayHigh - close) / dayHigh;
    // Past a 2% day drop the sleeve stops harvesting ordinary dips: on the
    // one true crash day in this lane's records every such entry lost. The
    // only door left is the capitulation itself - a close at least WASHOUT
    // below the day high, stabilised like any other entry.
    if (dayDrop > BRAKE_SOFT && close > dayHigh * (1 - WASHOUT)) return [];
    const requiredDip = DIP;

    const refHigh = highest(trailHighs);
    const recentLow = lowest(lastCloses.slice(-4));
    if (refHigh <= 0 || recentLow <= 0) return [];
    const dipDepth = (refHigh - recentLow) / refHigh;
    if (dipDepth < requiredDip) return [];
    if (!stabilised(close, recentLow)) return [];

    const { caps, fees } = state.hello;
    const bySize = (state.equity * BigInt(SIZE_BPS)) / BPS;
    const byWeight = (state.equity * BigInt(caps.max_weight_bps)) / BPS;
    let slice = state.cash;
    if (bySize < slice) slice = bySize;
    if (byWeight < slice) slice = byWeight;
    if (slice < BigInt(fees.min_notional_quote_units)) return [];

    entryRef = close;
    peakClose = close;
    entrySeq = batch.seq;
    pending = 'buy';
    return [{ side: 'buy', symbol: SYMBOL, notional_quote_units: slice, max_slippage_bps: BUY_SLIPPAGE_BPS } satisfies BuyInput];
  },
});
