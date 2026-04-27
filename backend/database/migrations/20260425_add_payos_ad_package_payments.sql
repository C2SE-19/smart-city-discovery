ALTER TABLE IF EXISTS ad_package_purchase_history
ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'paid',
ADD COLUMN IF NOT EXISTS payment_provider TEXT NOT NULL DEFAULT 'manual',
ADD COLUMN IF NOT EXISTS payment_amount NUMERIC(12,0) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS payment_expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS payment_confirmed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS payment_cancelled_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS payment_reference TEXT,
ADD COLUMN IF NOT EXISTS payment_payload JSONB,
ADD COLUMN IF NOT EXISTS payos_order_code BIGINT,
ADD COLUMN IF NOT EXISTS payos_payment_link_id TEXT,
ADD COLUMN IF NOT EXISTS payos_checkout_url TEXT,
ADD COLUMN IF NOT EXISTS payos_status TEXT;

UPDATE ad_package_purchase_history AS purchases
SET payment_amount = COALESCE(NULLIF(purchases.payment_amount, 0), packages.price, 0),
    payment_status = COALESCE(NULLIF(BTRIM(purchases.payment_status), ''), 'paid'),
    payment_provider = COALESCE(NULLIF(BTRIM(purchases.payment_provider), ''), 'manual'),
    paid_at = COALESCE(purchases.paid_at, purchases.activated_at, purchases.purchased_at),
    payment_confirmed_at = COALESCE(purchases.payment_confirmed_at, purchases.paid_at, purchases.activated_at, purchases.purchased_at)
FROM ad_packages AS packages
WHERE packages.id = purchases.ad_package_id;

CREATE INDEX IF NOT EXISTS ad_package_purchase_history_payment_status_idx
ON ad_package_purchase_history(payment_status, purchased_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS ad_package_purchase_history_payos_order_code_uidx
ON ad_package_purchase_history(payos_order_code)
WHERE payos_order_code IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ad_package_purchase_history_payos_payment_link_uidx
ON ad_package_purchase_history(payos_payment_link_id)
WHERE payos_payment_link_id IS NOT NULL;
