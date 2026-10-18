# React + TypeScript + Vite

## Visitor analytics

Apply the foundational migration `202609290001_capitalized_store_tables.sql` before the feature migrations so the `Categories` and `Products` tables exist. Then apply `202610090001_visitor_session_analytics.sql`, `202610090002_visitor_identity_and_preferences.sql`, `202610090003_anonymous_page_view_counts.sql`, `202610100001_customer_order_cancellation.sql`, `202610100002_product_reviews_and_admin.sql`, and `202610160001_admin_product_images.sql` in order in the Supabase SQL Editor. The product image migration creates a public image bucket with uploads and removals restricted to store administrators. The product-review migration also adds `Products.category_id` if it is missing. The third migration replaces visitor-level records with one daily page-view aggregate and deletes visitor-level and legacy search-event rows, including their visitor/account IDs and preferences. The app increments that day's counter at most once per browser storage profile per UTC day. It stores only the current UTC date locally to prevent duplicate counts across reloads and tabs; Supabase receives no visitor identifier. If browser storage is unavailable, duplicate suppression cannot be guaranteed.

To see page views for the last 30 days, run this query in the Supabase SQL Editor:

```sql
select
	visit_day,
	page_views
from public."Site_Analytics_Daily"
where visit_day >= (now() at time zone 'UTC')::date - 29
order by visit_day desc;
```

This is an approximate count of browser profiles visiting each day, not distinct people. Clearing browser storage, using private browsing, or switching devices can result in another count. The public client can only call the counter function; it cannot read or directly modify the aggregate table.

## Account and order flows

The login page can email a password-reset link. Add the deployed site origin to Supabase Authentication URL Configuration's allowed redirect URLs for the recovery link to work. The recovery link opens a page to set a new password; the app never retrieves or emails the existing password.

Customers can cancel their own orders while the status is `pending` and must provide a reason (up to 500 characters). The cancellation is performed by a database function that checks the signed-in customer and current order status.

## Store administration and product reviews

After applying the final migration, grant store administrator access to the intended Supabase Auth user from the SQL Editor by inserting that user's UUID into `public."Store_Admins"`. The `is_store_admin()` database function and row-level security policies protect all administrative writes; hiding the admin page in the client is not the security boundary. Sign in with the authorized account, open the account profile, and select the store administration page.

The admin page can create and edit products and categories, upload JPG, PNG, or WebP product images (maximum 5 MB) to Supabase Storage, archive products without deleting order history, enter product details and delivery windows/fees, change the WhatsApp contact, and moderate reviews. Uploaded product image URLs are saved to the product record. Delivery fees are displayed as information only and are not currently added to order totals. Customers can upload a JPG, PNG, or WebP photo (maximum 5 MB) with a review only after a completed purchase; one review per customer/product is allowed. WhatsApp contact data is readable only by signed-in users and is only requested by the signed-in product-details view.

## Privacy and sales compliance review

The repository does not include a public privacy notice, terms/returns policy, a retention/deletion workflow, a privacy contact, or enough business details to verify legal compliance. Anonymous aggregate counts are a data-minimization measure, not a legal compliance certification. Before selling in Haiti and the United States, publish accurate disclosures for the business, data purposes, Supabase and payment processors, retention, user rights, shipping, returns, taxes, and contact information. U.S. obligations vary by state and business activity; obtain qualified local legal and tax advice before launch. Do not claim compliance until those items have been reviewed.

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react/README.md) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default tseslint.config({
  extends: [
    // Remove ...tseslint.configs.recommended and replace with this
    ...tseslint.configs.recommendedTypeChecked,
    // Alternatively, use this for stricter rules
    ...tseslint.configs.strictTypeChecked,
    // Optionally, add this for stylistic rules
    ...tseslint.configs.stylisticTypeChecked,
  ],
  languageOptions: {
    // other options...
    parserOptions: {
      project: ['./tsconfig.node.json', './tsconfig.app.json'],
      tsconfigRootDir: import.meta.dirname,
    },
  },
})
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default tseslint.config({
  plugins: {
    // Add the react-x and react-dom plugins
    'react-x': reactX,
    'react-dom': reactDom,
  },
  rules: {
    // other rules...
    // Enable its recommended typescript rules
    ...reactX.configs['recommended-typescript'].rules,
    ...reactDom.configs.recommended.rules,
  },
})
```
