# Vercel Deployment Guide

1. Create a Vercel project and connect this repository.
2. Add environment variables in Vercel dashboard matching `.env.example`.
3. For `SHEET_PRIVATE_KEY`, ensure newlines are properly encoded or use the raw key and Vercel's multiline input.
4. Set build command: `npm run build` and output directory default for Next.js.

Notes:
- Google service account used by `google-spreadsheet` must have access to the Google Spreadsheet.
- Add the spreadsheet and sheet titles exactly as: `Products`, `Categories`, `Orders`, `Leads`.
