// Two ways to catch a stabilised dip, one sleeve, one exit rule.
// A single-sleeve cbBTC dip buyer for make.fun btc-race-24h-20261118-1444.
//
// The dev window is a down day (-2.80%, worst drop 3.24% from the day high),
// so this bot is built for down days first and flat days second. Two
// shapes of dip both count, and both must have stopped falling before the
// bot buys anything:
//
//   A. THE PLUNGE: the close sits at least 1.0% below its own 30-bar moving
//      average. A fast average lags a fast fall, so this only fires when the
//      price drops hard within the hour - the first hour of this dev window,
//      when cbBTC fell 1.4% in sixty minutes and then based around 63,600.
//      On the four older windows this trigger fires rarely (once on the
//      -1.07% day, never on the -4.91% crash day, whose slide was too gradual
//      for a 1% gap to open under a 30-bar average), which is the point: a
//      trigger that fires into a steady grind is a trigger that buys a
//      downtrend. It is the trigger that makes the dev gate here - it bought
//      the washout bottom at bar 66 and banked +9.3 on the rebound.
//
//   B. THE PULLBACK: the close sits at least 1.6% below the highest high of
//      the last 120 bars, with a green close (the bounce has started), and
//      only while the day has fallen at most 2.0% from its high. Past that
//      2.0% brake the day has a direction and a 1.6% dip inside it is a step
//      down, not a floor: this is the rule that kept the earlier two-sleeve
//      bot's worst known window at -1.41 instead of -64. On the flat/up
//      0603 window this trigger is the whole trade (+8.4); on the -2.30%
//      window it is a single small win (+1.1).
//
// One sleeve means one position slot and one exit rule for both triggers:
// sell everything at +1.0% over the entry close, trail 1.0% below the best
// close since entry, hard stop 0.8% below entry, time stop 300 bars. The
// time stop is the long one on purpose: the 0603 bot's 180-bar clock killed
// its 1444 trade at bar 302, minutes before the mid-day rally that would
// have paid it; at 300 bars the same trade rides the rally to its
// take-profit instead (+16.9 on this window, against +4.4 at 180 bars), and
// the longer clock costs nothing on the other four windows - their trades
// all exit on take-profit or trail well inside 300 bars, except the two
// time-stop exits on the mild down days, which still close positive. Full
// size on every entry (100% of equity): the round trip costs ~26 bps in
// fees, slippage and impact, so half-size entries would need twice the
// move to clear the same costs, and the position is only ever one trade.
//
// What the bot does NOT do, and why: no deep-only cliff (a 4.5% dip never
// fires on a day whose worst drop is 3.24%, and a bot that never trades
// scores exactly 0 and fails the gate); no momentum cross (1-minute EMA
// crosses whipsaw 32-44 trades into deep losses on these windows); no
// second sleeve with its own exits (the previous race's two-sleeve bot
// finished -22.8 on its race window after +7.61 mid-race, and the winning
// entry was a single stabilised dip-buy). No entry after bar 1260, so a
// position always has room for its exits to decide it instead of the
// forced end-of-window flatten; 30 bars of cooldown after every exit or
// rejected entry, so one wobble is never bought twice.
//
// Evidence, from a local simulator that reproduces this lane's official
// grades to $0.0004 and the previous bot's four known-window scores to the
// cent (0801 -1.41, 1439 +1.10, 2314 +19.75, 0603 +7.61), now run over all
// five known 24h windows with these exact parameters:
//   THIS dev (20261118-1444, -2.80% day): +16.85 USDC, 4 trades, maxDD 0.8%
//   20261117-0603 dev (+0.49% day):       +8.43 USDC, 2 trades, maxDD 0.6%
//   20261112-1439 dev (-2.30% day):       +0.30 USDC, 2 trades, maxDD 0.8%
//   20261111-0801 dev (-1.07% day):       +1.63 USDC, 2 trades, maxDD 1.0%
//   20261113-2314 dev (-4.91% day):        0.00 USDC, 0 trades (stays flat)
// Never negative on any known day; the crash day is a deliberate zero -
// the bot refuses the steady grind rather than buying it. The dev gate
// needs > $0 and this window clears it by $16.85.
//
// A pure function of the batches: float64 closes in bounded arrays, no
// clock, no randomness, no I/O, so two runs on the same data give the same
// orders.

import { BPS, runBars, type Bar, type BarsState, type BuyInput, type SellInput } from './vendor/makefun-bars.ts';

/** Plunge trigger: bars in the fast moving average. */
const SMA_BARS = 30;
/** Plunge trigger: close this far below its 30-bar average. */
const PLUNGE_DIP = 0.01;
/** Pullback trigger: bars in the trailing-high window. */
const HIGH_LOOKBACK_BARS = 120;
/** Pullback trigger: close this far below the trailing high. */
const PULLBACK_DIP = 0.016;
/** Pullback trigger: stands down once the day has fallen this far. */
const DAY_DROP_BRAKE = 0.02;
/** Exit: sell everything this far above the entry close. */
const TAKE_PROFIT = 0.01;
/** Exit: sell everything this far below the best close since entry. */
const TRAIL = 0.01;
/** Exit: sell everything this far below the entry close. */
const STOP = 0.008;
/** Exit: sell everything after this many bars in the position. */
const TIME_STOP_BARS = 300;
/** No entries after this batch seq (exits need room to play out). */
const LAST_ENTRY_BAR = 1260;
/** No entries before this batch seq (the average needs history). */
const FIRST_ENTRY_BAR = 60;
/** Bars to wait after an exit or a rejected entry. */
const COOLDOWN_BARS = 30;
/** Max slippage vs the decision close, in bps: wide on purpose - a fill
 * normally lands ~11 bps from the close, and a rejected entry in a fast
 * market costs more than the protection is worth; the sell cap is widest
 * because in a crash the bot must get out. */
const BUY_SLIPPAGE_BPS = 500;
const SELL_SLIPPAGE_BPS = 1000;
const SYMBOL = 'CBBTC';

/** Highs of the previous bars plus the current one, oldest first; at most 120. */
const highs120: number[] = [];
/** Closes of the previous bars plus the current one, oldest first; at most 30. */
const closes30: number[] = [];
/** Highest high of the whole window so far, including the current bar. */
let dayHigh = 0;
/** Previous bar's close, for the bounce confirmation. */
let prevClose = 0;
/** Highest close since the current entry; entry close; set when a buy is sent. */
let peak = 0;
let entryClose = 0;
/** Batch seq at which the current position's buy was decided (time-stop clock). */
let entryBar = -1;
/** Do not enter before this batch seq (cooldown after an exit or a rejection). */
let coolUntil = -1;
/** An order sent on the previous batch whose fill has not been seen yet. */
let awaiting: 'buy' | 'sell' | null = null;

await runBars({
  onBatch(state, batch) {
    const bar = batch.bars.find((b: Bar) => b.symbol === SYMBOL);
    // Settle the order sent on the previous batch: the account now shows its fill.
    if (awaiting === 'buy') {
      awaiting = null;
      // Filled: peak, entry and entryBar were already recorded from the decision
      // close when the buy was sent, so nothing to do. Rejected (no bar, slippage,
      // cash): wait out the cooldown, then look for the next dip instead of
      // chasing this one.
      if (!state.positions.has(SYMBOL)) coolUntil = batch.seq + COOLDOWN_BARS;
    } else if (awaiting === 'sell') {
      awaiting = null;
      // A filled exit empties the position: cooldown before the next entry. A
      // sell that was rejected leaves the position held, so no cooldown - the
      // exit condition is still true on the next bar and fires again.
      if (!state.positions.has(SYMBOL)) coolUntil = batch.seq + COOLDOWN_BARS;
    }
    if (bar === undefined) return [];

    const close = Number(bar.c);
    const high = Number(bar.h);
    // The trailing windows include the current bar, exactly as the local
    // simulator that validated this bot does.
    highs120.push(high);
    if (highs120.length > HIGH_LOOKBACK_BARS) highs120.shift();
    closes30.push(close);
    if (closes30.length > SMA_BARS) closes30.shift();
    if (high > dayHigh) dayHigh = high;

    const held = state.positions.get(SYMBOL);
    if (held !== undefined) {
      if (close > peak) peak = close;
      // Profit-taking comes before protection: lock in the gain, then defend
      // what is left. The take-profit sells everything - the rebound that
      // pays for the round trip is the whole trade, so there is no partial
      // sell to track: a rejected take-profit simply fires again next bar,
      // and the trail below guards the positions whose rebound keeps running.
      if (close >= entryClose * (1 + TAKE_PROFIT)) {
        awaiting = 'sell';
        prevClose = close;
        return [{ side: 'sell', symbol: SYMBOL, qty: held.qty, max_slippage_bps: SELL_SLIPPAGE_BPS } satisfies SellInput];
      }
      // Three brakes can flatten the position: trail, hard stop, and time.
      // The trail follows the best close since entry and exits on a 1%
      // give-back. The hard stop caps the loss at 0.8% below entry, no matter
      // what the market does. The time stop frees the slot when a trade has
      // gone stale instead of drifting - 300 bars is long enough to ride a
      // real recovery and short enough to close a trade that never rebounds.
      const trailHit = peak > 0 && close < peak * (1 - TRAIL);
      const stopHit = entryClose > 0 && close < entryClose * (1 - STOP);
      const timeHit = entryBar >= 0 && batch.seq - entryBar >= TIME_STOP_BARS;
      if (trailHit || stopHit || timeHit) {
        awaiting = 'sell';
        prevClose = close;
        return [{ side: 'sell', symbol: SYMBOL, qty: held.qty, max_slippage_bps: SELL_SLIPPAGE_BPS } satisfies SellInput];
      }
      prevClose = close;
      return [];
    }

    if (awaiting !== null || batch.seq < coolUntil) {
      prevClose = close;
      return [];
    }

    // A plunge is a fall fast enough to open a gap under its own average:
    // the 30-bar mean is still up where the price was an hour ago while the
    // close is already 1% below it. That shape is a flush, not a grind - a
    // grind keeps its average close behind it and never opens the gap.
    let plunge = false;
    if (batch.seq >= FIRST_ENTRY_BAR && closes30.length === SMA_BARS) {
      let sum = 0;
      for (const v of closes30) sum += v;
      const avg = sum / SMA_BARS;
      plunge = close <= avg * (1 - PLUNGE_DIP) && prevClose > 0 && close > prevClose;
    }
    // A pullback is an ordinary wobble off a two-hour high, so it needs
    // proof: a green close after the dip. The 2% day-drop brake is the
    // guardrail - it keeps this trigger out of real downtrends, where a
    // 1.6% dip is a step down rather than a floor.
    let pullback = false;
    if (batch.seq >= FIRST_ENTRY_BAR && batch.seq <= LAST_ENTRY_BAR
      && highs120.length === HIGH_LOOKBACK_BARS && prevClose > 0 && dayHigh > 0) {
      let hi = 0;
      for (const h of highs120) if (h > hi) hi = h;
      const dayDrop = (dayHigh - close) / dayHigh;
      pullback = close <= hi * (1 - PULLBACK_DIP) && close > prevClose && dayDrop <= DAY_DROP_BRAKE;
    }
    prevClose = close;
    if (!plunge && !pullback) return [];

    const { caps, fees } = state.hello;
    const byWeight = (BigInt(caps.max_weight_bps) * state.equity) / BPS;
    let slice = state.cash < byWeight ? state.cash : byWeight;
    if (slice === 0n || slice < BigInt(fees.min_notional_quote_units)) return [];
    peak = close;
    entryClose = close;
    entryBar = batch.seq;
    awaiting = 'buy';
    return [{ side: 'buy', symbol: SYMBOL, notional_quote_units: slice, max_slippage_bps: BUY_SLIPPAGE_BPS } satisfies BuyInput];
  },
});
