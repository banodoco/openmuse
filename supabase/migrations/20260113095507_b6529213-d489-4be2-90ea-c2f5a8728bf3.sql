-- Update LTX-2 model variant to 19B
UPDATE models SET variants = '["19B"]', default_variant = '19B' WHERE internal_identifier = 'ltx2';