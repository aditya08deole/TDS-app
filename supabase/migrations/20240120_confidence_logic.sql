-- Phase 3: Confidence Score Engine
-- Enables nuanced "Trust Score" (0-100%) for devices

-- 1. Add confidence_score column if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'devices' AND column_name = 'confidence_score') THEN 
        ALTER TABLE public.devices ADD COLUMN confidence_score INTEGER DEFAULT 100 CHECK (confidence_score BETWEEN 0 AND 100); 
    END IF; 
END $$;

-- 2. Function to calculate/decay scores
-- This should be run periodically (e.g., hourly)
create or replace function calculate_confidence_scores()
returns void
language plpgsql
security definer
as $$
begin
  -- Rule 1: Decay offline devices
  -- If offline for > 1 hour, lose 5 points.
  -- This is a simple linear decay for the MVP.
  update public.devices
  set confidence_score = greatest(0, confidence_score - 5)
  where status = 'offline'
  and last_seen_at < (now() - interval '1 hour');
  
  -- Rule 2: Recovery
  -- If online, slowly regain confidence (but perfectly stable devices stay at 100)
  -- We assume 'online' devices are sending heartbeats.
  update public.devices
  set confidence_score = least(100, confidence_score + 2)
  where status = 'online'
  and confidence_score < 100;
end;
$$;
