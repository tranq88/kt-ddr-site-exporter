# kt-ddr-site-exporter
Export your scores from https://p.eagate.573.jp/game/ddr/ddra20/p into a BATCH-MANUAL JSON for use with [Kamaitachi](https://kamai.tachi.ac/).

Currently only supports A20 PLUS.

Inspired by [kt-chunithm-site-importer](https://github.com/beer-psi/kt-chunithm-site-importer).

# Installation

1. Install a userscript manager (e.g. Greasemonkey or Tampermonkey).
2. Create a new script with [kt-ddr-site-exporter.js](https://github.com/tranq88/kt-ddr-site-exporter/blob/main/kt-ddr-site-exporter.js) as its contents.

# Usage

1. Log in to https://p.eagate.573.jp/game/ddr/ddra20/p.
2. Use the buttons in the top-right to export. Refreshing or leaving the page will cancel the export.
3. Go to https://kamai.tachi.ac/import?game=ddr and import via Batch Manual.

# Notes
- You need to be subscribed to the [e-amusement Basic Course](https://p.eagate.573.jp/payment/p/course_detail.html?course=eaBASIC) in order to access your full play data (and, in turn, make use of this script).
- This script is primarily meant for backfilling PBs, as it makes a large number of requests in a short amount of time. Using an [alternative score tracker](https://3icecream.com/) or [manual input](https://gyoo.github.io/Sukoa) for recent scores is preferable.
