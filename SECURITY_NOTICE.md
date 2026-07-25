# Security Notice

The original upload contained working credentials in `.env` and one MongoDB
credential was hardcoded in `test-db.js`. The corrected source removes the
hardcoded credential and ignores `.env`.

Because the credentials were shared in source, rotate them in their respective
dashboards before using or publishing this project. Never commit `.env`.
