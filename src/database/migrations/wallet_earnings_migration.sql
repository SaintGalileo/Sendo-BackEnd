-- Add Payment Method field to orders
ALTER TABLE IF EXISTS orders ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'wallet';
ALTER TABLE IF EXISTS orders ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending';

-- Create Wallets table
CREATE TABLE IF NOT EXISTS wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    balance DECIMAL(12, 2) DEFAULT 0.00,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Wallet Transactions table
CREATE TABLE IF NOT EXISTS wallet_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
    amount DECIMAL(12, 2) NOT NULL,
    type TEXT CHECK (type IN ('credit', 'debit')),
    description TEXT,
    order_id UUID, -- Optional link to an order
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Merchant Earnings table
CREATE TABLE IF NOT EXISTS merchant_earnings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    total_earnings DECIMAL(12, 2) DEFAULT 0.00,
    current_balance DECIMAL(12, 2) DEFAULT 0.00,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(merchant_id)
);

-- Enable RLS
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE merchant_earnings ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own wallet" ON wallets FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can view their own transactions" ON wallet_transactions FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM wallets WHERE wallets.id = wallet_transactions.wallet_id AND wallets.user_id = auth.uid()));
CREATE POLICY "Merchants can view their own earnings" ON merchant_earnings FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM merchants WHERE merchants.id = merchant_earnings.merchant_id AND merchants.user_id = auth.uid()));

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_wallets_updated_at BEFORE UPDATE ON wallets FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_merchant_earnings_updated_at BEFORE UPDATE ON merchant_earnings FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
