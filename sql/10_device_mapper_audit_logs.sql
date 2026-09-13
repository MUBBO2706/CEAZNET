-- ==============================================================================
-- DEVICE MAPPER / RESOLVER EXTERNAL AUDIT LOGS TABLE
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.device_mapper_audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    domain TEXT,
    origin TEXT,
    referer TEXT,
    client_ip TEXT,
    user_agent TEXT,
    method TEXT,
    action TEXT,
    model TEXT,
    is_external BOOLEAN DEFAULT FALSE,
    status_code INTEGER,
    request_query JSONB,
    request_body JSONB,
    response_body JSONB,
    execution_time_ms NUMERIC,
    error_message TEXT
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_device_mapper_audit_logs_created_at ON public.device_mapper_audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_device_mapper_audit_logs_is_external ON public.device_mapper_audit_logs (is_external);
CREATE INDEX IF NOT EXISTS idx_device_mapper_audit_logs_domain ON public.device_mapper_audit_logs (domain);

-- Row Level Security (RLS) Configuration
ALTER TABLE public.device_mapper_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read write for device mapper audit logs" ON public.device_mapper_audit_logs;
CREATE POLICY "Allow read write for device mapper audit logs" 
ON public.device_mapper_audit_logs 
FOR ALL 
USING (true) 
WITH CHECK (true);
