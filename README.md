# Token Radar

Which pre-token protocol is worth farming next? This entry reads one sealed
DefiLlama snapshot, ranks every protocol that records no token and is not a
wrapped, staked or bridged product of a token that already trades, and hands
in a dashboard with the board, a detail view per protocol, and a farm plan for
each one.

## Run

```sh
node main.ts --input <snapshot-dir> --output <out-dir>
```

`--input` defaults to `/input` and `--output` to `out` (or
`MAKEFUN_INPUT_DIR` / `MAKEFUN_OUTPUT_DIR`). The program writes `board.json`,
`data.js`, a copy of `dashboard/`, a copy of `screenshots/` and `dossier.json`,
then refuses the run if its own checks fail. Two runs write identical bytes.

## The model — radar-3

A protocol is rankable when its record carries no token (`mcap_usd`,
`gecko_id` and `symbol` all null) **and** it passes the watchlist's own
exclusion rule, applied to the whole board:

- category not in Bridge, Canonical Bridge, Cross Chain Bridge, Liquid
  Staking, Liquid Restaking, Restaked BTC, CEX
- name ends in no version marker
- name carries no whole word `wrapped`, `staked` or `staking`
- name begins with no exchange's name

The rule's "Cross Chain Bridge" entry is the one addition: DefiLlama labels
the same kind of product under two names, and the house's rule names only
"Bridge" and "Canonical Bridge". One row falls under it — Circle Gateway, a
product of Circle, whose USDC already trades.

On this snapshot the board is **197 rows**: the 40 watchlist protocols, all
covered, plus 157 beyond it. The starter's looser rule (exchanges and
versioned names only) admits 91 wrapped, staked and bridged products — WBTC
($7.9B TVL), Binance staked ETH ($7.4B), Coinbase Bridge ($7.2B) — which
would top its ranking as fake "pre-token launches". This board excludes all
of them.

Implied value, from the snapshot's own figures only:

```
implied = TVL × 0.25
        × (1 + clamp(7d, −60, +120) ÷ 100 × 0.5)
        × (0.6 + min(age_days, 1095) ÷ 1095 × 0.4)
        × (1 + 0.02 × min(chains, 5))
```

Age is null → 365 days. No protocol name is ever special-cased. The
snapshot carries no `parentProtocol` field, so a sub-product of a tokened
parent that passes the name and category tests stays on the board as a record
with no token — the dashboard says a protocol "records no token", never that
it has none.

## Farm plans

Eight steps per protocol, derived from its own record (category, chains, TVL,
age): a fresh wallet, the category action with a capital tier ($250 ≥ $5B,
$150 ≥ $1B, $100 ≥ $100M, else $50), one qualifying action a week, a hold
(60 days if younger than 180 days, 45 if younger than a year, else 30), a
check of the protocol's own points page, a risk check (domain, contract,
health limits, revoke unused approvals), a farm log, and an exit step —
unwind when the token launches, the points window closes, or TVL falls by a
third. Every step states its cost and time. The detail view recomputes the
implied value from the full-precision factors and matches the board exactly.

## Layout

- `main.ts` — the build: snapshot in, board + dashboard + dossier out.
- `lib/model.ts` — the model, the rule, the farm plans, the board builder.
- `vendor/makefun-board.ts` — the kit's dossier library, copied byte for byte.
- `dashboard/` — the static page: `index.html`, `app.css`, `app.js`. No
  network, no fetch, no CDN. The page renders `data.js` (written beside it).
- `screenshots/` — board, detail, filtered view (1440×900 JPEG).
- `.makefun/owner.json` — the owner's Solana wallet.

## Verify

Run the program twice and compare the outputs byte for byte. Open
`out/dashboard/index.html` in a browser: the board sorts and filters, every
row opens a detail view with its model breakdown and farm plan, and the live
tab shows the protocols that already trade, set aside from the ranking.
