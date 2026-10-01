# MonCash checkout function

The function recalculates the cart total from the authenticated user's `Cart`
rows and `Products` prices, creates a pending order, requests a MonCash payment
token, and returns the provider redirect URL. It does not trust a client-sent
price or user ID.

## Configure and deploy

Apply the migrations that create `Cart` and add the MonCash order columns before
deploying this function. Then, from the linked Supabase project, set secrets:

```sh
supabase secrets set MONCASH_CLIENT_ID=your-client-id MONCASH_CLIENT_SECRET=your-client-secret MONCASH_ENVIRONMENT=sandbox
supabase functions deploy moncash-checkout
```

Do not use `VITE_` variables for MonCash credentials; those would be exposed to
the browser. The function defaults to the sandbox API. Set
`MONCASH_ENVIRONMENT=production` only when production merchant access is
approved.

The endpoint and payload currently follow community-maintained SDK examples,
not publicly accessible official MonCash API documentation. Confirm them with
the merchant integration guide before production use:

- https://github.com/midsonlajeanty/php-moncash-sdk
- https://github.com/ecelestin/ecelestin-Moncash-sdk-nodejs

The order remains `pending` after redirect. Payment return handling, transaction
verification, and marking an order paid must be added against the merchant's
verified callback and transaction-verification requirements before accepting
live payments.
