-- Add recording_url to whatsapp_infra.call_logs
ALTER TABLE whatsapp_infra.call_logs 
ADD COLUMN IF NOT EXISTS recording_url TEXT;
