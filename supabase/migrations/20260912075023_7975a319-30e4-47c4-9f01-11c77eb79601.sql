UPDATE public.gifts
SET name = 'Royal Beads',
    description = 'Ceremonial royal coral beads.',
    asset_url = 'gift:royal-beads'
WHERE asset_url = 'gift:coral-beads'
   OR name = 'Corallium Red Coral Beads';