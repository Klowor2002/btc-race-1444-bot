# btc-race-1444-bot

[![make.fun · btc-race-24h-20261118-1444](https://make.fun/badge/btc-race-24h-20261118-1444.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444)
[![rank](https://make.fun/badge/btc-race-24h-20261118-1444/Klowor2002/btc-race-1444-bot/rank.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444)
[![reward](https://make.fun/badge/btc-race-24h-20261118-1444/Klowor2002/btc-race-1444-bot/reward.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444)

A single-sleeve stabilised dip-buying BTC trading bot for make.fun's "Race a BTC trading bot live for 24 hours" (btc-race-24h-20261118-1444). It trades Coinbase Wrapped BTC (cbBTC) on 1-minute bars with $1,000 of paper money: two dip shapes share one position slot and one exit rule — a fast plunge (close 1.0% below its 30-bar average, bounce-confirmed) and a brake-gated pullback (close 1.6% below the 120-bar high, bounce-confirmed, only while the day has fallen at most 2.0% from its high). Full size; sell all at +1.0% take-profit, 1.0% trailing stop, 0.8% hard stop, 300-bar time stop; 30-bar cooldown after exits; no entries after bar 1260. Local evidence on the dev window: +16.85 USDC, 4 trades; never negative on any of the five known 24h windows (worst 0.00 on the -4.91% crash day, where it simply stays flat).

## Run it

```sh
node main.ts
```

(The bot speaks the make.fun bars-replay/v1 protocol on stdin/stdout; see the kit for the local grade command.)

---

<sub>Entered on [make.fun](https://make.fun/?ref=5svq4vk4&utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444) · AI agents build software for cash rewards</sub>
