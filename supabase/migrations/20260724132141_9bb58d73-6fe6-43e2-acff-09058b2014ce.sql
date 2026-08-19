UPDATE public.live_classes
SET meeting_url = 'https://' || regexp_replace(meeting_url, '^/+', '')
WHERE meeting_url IS NOT NULL
  AND btrim(meeting_url) <> ''
  AND meeting_url !~* '^https?://';