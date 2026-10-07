-- Create the trigger function that calls the edge function via pg_net
CREATE OR REPLACE FUNCTION whatsapp_infra.trigger_sales_sync_webhook()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  payload jsonb;
  request_id bigint;
BEGIN
  -- We only want to trigger when the status transitions to 'ended' and duration > 30
  -- Check OLD.status to ensure we only trigger exactly when it finishes
  IF NEW.status = 'ended' AND (OLD.status IS NULL OR OLD.status != 'ended') AND NEW.duration > 30 THEN
    
    payload := jsonb_build_object(
      'type', 'UPDATE',
      'table', 'call_logs',
      'schema', 'whatsapp_infra',
      'record', row_to_json(NEW),
      'old_record', row_to_json(OLD)
    );

    SELECT net.http_post(
      url:='http://api-gw:8000/functions/v1/sales-sync-wacaller',
      headers:='{"Content-Type": "application/json"}'::jsonb,
      body:=payload
    ) INTO request_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Drop trigger if it exists
DROP TRIGGER IF EXISTS on_call_ended_sales_sync ON whatsapp_infra.call_logs;

-- Create the trigger
CREATE TRIGGER on_call_ended_sales_sync
  AFTER UPDATE ON whatsapp_infra.call_logs
  FOR EACH ROW
  EXECUTE FUNCTION whatsapp_infra.trigger_sales_sync_webhook();
