[![make.fun · csv-reader-speed-01-run-20261121](https://make.fun/badge/csv-reader-speed-01-run-20261121.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![rank](https://make.fun/badge/csv-reader-speed-01-run-20261121/akitaBugBounty/csv-reader-speed-01-run-20261121/rank.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121)
[![reward](https://make.fun/badge/csv-reader-speed-01-run-20261121/akitaBugBounty/csv-reader-speed-01-run-20261121/reward.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121)

https://make.fun/bounty/csv-reader-speed-01-run-20261121

# csv-reader-speed-01-run-20261121

A faster drop-in for make.fun's own csv-reader 1.0.0: `solve.js` answers
every case exactly as csv-reader does — same `{columns, rows, errors}`,
including its broken-row policy (BOM, stray CR, quote junk, unterminated
quote, short/long rows) — but parses with slice/`indexOf` scans instead of
one character at a time. `main.ts` reads `/input/cases.json`, answers each
case alone with `run()`, and writes `/output/answers.json`.
