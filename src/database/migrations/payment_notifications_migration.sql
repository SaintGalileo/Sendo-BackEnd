-- Migration to create payment_notifications table for logging incoming webhooks
CREATE TABLE IF NOT EXISTS payment_notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider TEXT NOT NULL DEFAULT 'seerbit',
    payload JSONB NOT NULL,
    status TEXT DEFAULT 'received',
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for faster filtering by provider and status
CREATE INDEX IF NOT EXISTS idx_payment_notifications_provider ON payment_notifications(provider);
CREATE INDEX IF NOT EXISTS idx_payment_notifications_status ON payment_notifications(status);
CREATE INDEX IF NOT EXISTS idx_payment_notifications_created_at ON payment_notifications(created_at);
