# MonCash checkout temporarily disabled

The checkout UI no longer offers MonCash, and this Edge Function responds with
HTTP 410. To disable the already-deployed endpoint, deploy this stub from the
linked Supabase project:

```sh
supabase functions deploy moncash-checkout
```

Existing MonCash orders and their database fields are preserved. Re-enable
MonCash only after implementing and verifying the payment confirmation flow
against the merchant's current integration requirements.
