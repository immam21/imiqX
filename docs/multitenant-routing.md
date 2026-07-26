# Multi-Tenant Routing and Isolation

This platform supports two tenant routing modes:

1. Shared domain path mode
- `https://mydomain.in/businessname1`
- `https://mydomain.in/businessname1/products`
- `https://mydomain.in/businessname1/cart`
- `https://mydomain.in/businessname1/checkout`

2. Bring-your-own-domain mode
- `https://tenant1.com`
- `https://shop.tenant2.com`

## Strict Isolation Model

- Tenant context is resolved from URL path prefix or mapped domain.
- Product, order, coupon, review, banner, track-order, admin, and payment APIs query by tenant ID.
- Cart and coupon localStorage are tenant-scoped to prevent browser-side data bleed between tenants.
- Payment gateway keys are tenant-specific (loaded from tenant settings), not global.

## Route Rules

- `/{tenant}` resolves tenant storefront home.
- `/{tenant}/products` aliases to listing page.
- `/{tenant}/products/{id}` aliases to product detail.
- `/{tenant}/cart`, `/{tenant}/checkout`, `/{tenant}/track-order` stay tenant-scoped.
- Shared-domain storefront URLs without tenant prefix are redirected to last-known tenant prefix.

## Domain Mapping (BYOD)

Map custom domains in `tenant_domains` table:

- `tenant_id`: UUID from `tenants`
- `host` (or legacy `domain`): exact hostname, lowercase (example: `shop.tenant1.com`)
- `type`: `custom` or `subdomain`
- `is_primary`: true for primary domain of tenant
- `is_verified`: true after DNS verification

Only mapped domains are treated as tenant domains. Unmapped domains do not resolve tenant data.

### How It Works Now

- A mapped host like `shop.client.com` resolves directly to that tenant storefront.
- Home route `/` on custom domain automatically serves tenant storefront home.
- Store routes on custom domain also work directly:
	- `/products` -> tenant product listing
	- `/products/{id}` -> tenant product detail
	- `/cart`, `/checkout`, `/track-order`, `/admin`
- Shared domain path mode (`/{tenant}/...`) continues to work unchanged.

### Platform Admin Configuration

Use Platform Admin -> Tenants -> `Custom Domain` field.

- Create tenant: set `Custom Domain` (optional)
- Edit tenant: update/clear `Custom Domain`

This writes to `tenant_domains` and enables direct host routing.

### DNS / Reverse Proxy Notes

- Point client domain DNS (A/CNAME) to your deployment host.
- Ensure your reverse proxy forwards original `Host` header.
- Configure TLS certificate for the client domain.

### Local Testing (Development)

To test locally from the same machine:

1. Add hosts entry:
	 - `127.0.0.1 shop.client.local`
2. Add `shop.client.local` as tenant `Custom Domain` in Platform Admin.
3. Open `http://shop.client.local:3000/`

You should see the mapped tenant storefront directly without `/tenant-slug` prefix.

## Tenant Payment Settings

Set the following keys in `tenant_settings` for each tenant:

- `RazorpayKeyID`
- `RazorpayKeySecret`

Fallback to global env values is supported for transition, but per-tenant keys are required for strict production isolation.

## Platform Domain Setting

Set one of:

- `PLATFORM_BASE_DOMAIN`
- `NEXT_PUBLIC_PLATFORM_DOMAIN`

Used to identify shared-domain storefront host and preserve tenant prefix behavior.
