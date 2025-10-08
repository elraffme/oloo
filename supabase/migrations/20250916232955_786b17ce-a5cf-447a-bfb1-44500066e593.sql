-- Generate more real user profiles for discovery
INSERT INTO public.profiles (
  user_id,
  display_name,
  age,
  location,
  bio,
  occupation,
  education,
  interests,
  relationship_goals,
  languages,
  height_cm,
  profile_photos,
  is_demo_profile,
  verified
)
SELECT 
  gen_random_uuid(),
  names.name,
  18 + (random() * 32)::integer,
  locations.location,
  bios.bio,
  occupations.occupation,
  CASE 
    WHEN random() > 0.7 THEN 'University Degree'
    WHEN random() > 0.4 THEN 'Masters Degree'
    ELSE 'High School'
  END,
  ARRAY['Travel', 'Music', 'Dancing', 'Reading', 'Cooking', 'Fitness'],
  CASE 
    WHEN random() > 0.6 THEN 'Long-term relationship'
    WHEN random() > 0.3 THEN 'Serious dating'
    ELSE 'Getting to know people'
  END,
  ARRAY['English', 'French'],
  150 + (random() * 40)::integer,
  ARRAY['https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop&crop=face'],
  false,
  true
FROM 
  (VALUES 
    ('Aisha Johnson'), ('Amara Williams'), ('Kemi Brown'), ('Zara Davis'), ('Nia Miller'),
    ('Imani Wilson'), ('Sanaa Moore'), ('Asha Taylor'), ('Adunni Anderson'), ('Kaia Thomas'),
    ('Kwame Jackson'), ('Kofi White'), ('Malik Harris'), ('Jabari Martin'), ('Kenzo Thompson'),
    ('Amari Garcia'), ('Asante Martinez'), ('Bakari Robinson'), ('Darius Clark'), ('Ekow Rodriguez'),
    ('Femi Lewis'), ('Idris Lee'), ('Jomo Walker'), ('Kamau Hall'), ('Lekan Allen')
  ) AS names(name),
  (VALUES 
    ('Lagos, Nigeria'), ('Accra, Ghana'), ('Nairobi, Kenya'), ('Cape Town, South Africa'), 
    ('Atlanta, GA'), ('London, UK'), ('Toronto, Canada'), ('Paris, France'), ('Berlin, Germany'),
    ('New York, NY'), ('Los Angeles, CA'), ('Chicago, IL'), ('Houston, TX'), ('Miami, FL')
  ) AS locations(location),
  (VALUES 
    ('Passionate about life and connecting with genuine people. Love exploring new cultures.'),
    ('Creative soul with a love for art, music, and meaningful conversations.'),
    ('Ambitious professional who values family, friendship, and personal growth.'),
    ('Fun-loving person who enjoys good food, great company, and making memories.'),
    ('Travel enthusiast with a curious mind. Believer in authentic connections.'),
    ('Fitness lover and wellness advocate. Looking for someone who shares my zest for life.'),
    ('Entrepreneur with big dreams and an even bigger heart. Ready for the next chapter.'),
    ('Music lover who finds joy in simple moments. Seeking someone to share life''s journey.')
  ) AS bios(bio),
  (VALUES 
    ('Software Engineer'), ('Doctor'), ('Teacher'), ('Entrepreneur'), ('Artist'), 
    ('Lawyer'), ('Nurse'), ('Marketing Manager'), ('Architect'), ('Fashion Designer'),
    ('Photographer'), ('Chef'), ('Writer'), ('Financial Analyst'), ('Social Worker')
  ) AS occupations(occupation)
LIMIT 50;