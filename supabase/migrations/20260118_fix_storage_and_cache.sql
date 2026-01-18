-- Create storage bucket for QR codes if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('qr_codes', 'qr_codes', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public access to qr_codes bucket (simplistic policy for demo; refine for production)
-- Policy for SELECT (viewing)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Public Access'
    ) THEN
        CREATE POLICY "Public Access"
        ON storage.objects FOR SELECT
        USING ( bucket_id = 'qr_codes' );
    END IF;
END
$$;

-- Policy for INSERT (uploading)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Public Upload'
    ) THEN
        CREATE POLICY "Public Upload"
        ON storage.objects FOR INSERT
        WITH CHECK ( bucket_id = 'qr_codes' );
    END IF;
END
$$;

-- Force PostgREST schema cache reload to recognize new columns in 'devices'
NOTIFY pgrst, 'reload config';
