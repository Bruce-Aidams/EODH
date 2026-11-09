-- EODH Development Seed Data
-- Run this script after the main schema to populate development/test data
-- This is for development only — do not run in production

-- ============================================================
-- Book Categories
-- ============================================================
INSERT INTO book_categories (id, name, description) VALUES
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567891', 'Philosophy', 'Philosophical works and treatises'),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567892', 'Theology', 'Theological studies and religious texts'),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567893', 'Science', 'Scientific literature and research'),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567894', 'Literature', 'Fiction, poetry, and literary works'),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567895', 'History', 'Historical accounts and biographies'),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567896', 'Self-Help', 'Personal development and improvement'),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567897', 'Technology', 'Technology and computer science'),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567898', 'Reference', 'Reference materials and encyclopedias');

-- ============================================================
-- Sample Books
-- ============================================================
INSERT INTO books (id, title, author, description, category_id, language, publication_date, document_type, document_url, cover_url, is_published, created_by) VALUES
  ('b1b2c3d4-e5f6-7890-abcd-ef1234567891', 
   'Meditations', 
   'Marcus Aurelius', 
   'Personal writings of Roman Emperor Marcus Aurelius. A work of practical philosophy written in military camps, offering guidance on self-improvement, duty, and the nature of the universe.',
   'a1b2c3d4-e5f6-7890-abcd-ef1234567891', 'en', '180-01-01', 'markdown', 'https://example.com/meditations.md', NULL, true, NULL),
  
  ('b1b2c3d4-e5f6-7890-abcd-ef1234567892', 
   'The Republic', 
   'Plato', 
   'A Socratic dialogue concerning justice, the order and character of the just city-state, and the just man. One of the most influential works of philosophy and political theory.',
   'a1b2c3d4-e5f6-7890-abcd-ef1234567891', 'en', '-380-01-01', 'markdown', 'https://example.com/republic.md', NULL, true, NULL),
  
  ('b1b2c3d4-e5f6-7890-abcd-ef1234567893', 
   'A Brief History of Time', 
   'Stephen Hawking', 
   'A landmark volume in science writing that explores the nature of space, time, and the universe. From the Big Bang to black holes, Hawking makes complex concepts accessible.',
   'a1b2c3d4-e5f6-7890-abcd-ef1234567893', 'en', '1988-04-01', 'pdf', 'https://example.com/brief-history.pdf', NULL, true, NULL),
  
  ('b1b2c3d4-e5f6-7890-abcd-ef1234567894', 
   'The Art of War', 
   'Sun Tzu', 
   'An ancient Chinese military treatise dating from the Late Spring and Autumn Period. The work is attributed to the general Sun Tzu and remains influential in military strategy and business.',
   'a1b2c3d4-e5f6-7890-abcd-ef1234567895', 'en', '-500-01-01', 'markdown', 'https://example.com/art-of-war.md', NULL, true, NULL),
  
  ('b1b2c3d4-e5f6-7890-abcd-ef1234567895', 
   'Thinking, Fast and Slow', 
   'Daniel Kahneman', 
   'A tour of the two systems that drive the way we think. System 1 is fast, intuitive, and emotional; System 2 is slower, more deliberative, and more logical.',
   'a1b2c3d4-e5f6-7890-abcd-ef1234567896', 'en', '2011-10-01', 'pdf', 'https://example.com/thinking-fast-slow.pdf', NULL, true, NULL),
  
  ('b1b2c3d4-e5f6-7890-abcd-ef1234567896', 
   'Pride and Prejudice', 
   'Jane Austen', 
   'A romantic novel of manners that follows the character development of Elizabeth Bennet, the dynamic protagonist who learns about the repercussions of hasty judgments.',
   'a1b2c3d4-e5f6-7890-abcd-ef1234567894', 'en', '1813-01-28', 'markdown', 'https://example.com/pride-prejudice.md', NULL, true, NULL);

-- ============================================================
-- Sample Audiobooks
-- ============================================================
INSERT INTO audio_books (book_id, audio_type, audio_url, total_duration, is_active) VALUES
  ('b1b2c3d4-e5f6-7890-abcd-ef1234567891', 'prerecorded', 'https://example.com/meditations-audio.mp3', 7200, true),
  ('b1b2c3d4-e5f6-7890-abcd-ef1234567894', 'prerecorded', 'https://example.com/art-of-war-audio.mp3', 3600, true);

-- ============================================================
-- Sample Audio Segments (Chapters)
-- ============================================================
INSERT INTO audio_segments (id, book_id, chapter_id, text, audio_url, start_time, end_time, order_index) VALUES
  ('s1b2c3d4-e5f6-7890-abcd-ef1234567891', 'b1b2c3d4-e5f6-7890-abcd-ef1234567891', NULL, 'Book I: On the Governing Mind', 'https://example.com/meditations-ch1.mp3', 0, 1200, 0),
  ('s1b2c3d4-e5f6-7890-abcd-ef1234567892', 'b1b2c3d4-e5f6-7890-abcd-ef1234567891', NULL, 'Book II: On the Place and the Matter', 'https://example.com/meditations-ch2.mp3', 1200, 2300, 1),
  ('s1b2c3d4-e5f6-7890-abcd-ef1234567893', 'b1b2c3d4-e5f6-7890-abcd-ef1234567891', NULL, 'Book III: On the Derived and the Inherent Good', 'https://example.com/meditations-ch3.mp3', 2300, 3600, 2),
  ('s1b2c3d4-e5f6-7890-abcd-ef1234567894', 'b1b2c3d4-e5f6-7890-abcd-ef1234567891', NULL, 'Book IV: On the Inner Citadel', 'https://example.com/meditations-ch4.mp3', 3600, 5000, 3),
  ('s1b2c3d4-e5f6-7890-abcd-ef1234567895', 'b1b2c3d4-e5f6-7890-abcd-ef1234567891', NULL, 'Book V: On the Ephemeral and the Unknown', 'https://example.com/meditations-ch5.mp3', 5000, 6200, 4),
  ('s1b2c3d4-e5f6-7890-abcd-ef1234567896', 'b1b2c3d4-e5f6-7890-abcd-ef1234567891', NULL, 'Book VI: The Heraclitean Theory', 'https://example.com/meditations-ch6.mp3', 6200, 7200, 5),
  
  ('s1b2c3d4-e5f6-7890-abcd-ef12345678a1', 'b1b2c3d4-e5f6-7890-abcd-ef1234567894', NULL, 'Laying Plans', 'https://example.com/art-of-war-ch1.mp3', 0, 600, 0),
  ('s1b2c3d4-e5f6-7890-abcd-ef12345678a2', 'b1b2c3d4-e5f6-7890-abcd-ef1234567894', NULL, 'Waging War', 'https://example.com/art-of-war-ch2.mp3', 600, 1100, 1),
  ('s1b2c3d4-e5f6-7890-abcd-ef12345678a3', 'b1b2c3d4-e5f6-7890-abcd-ef1234567894', NULL, 'Attack by Stratagem', 'https://example.com/art-of-war-ch3.mp3', 1100, 1650, 2),
  ('s1b2c3d4-e5f6-7890-abcd-ef12345678a4', 'b1b2c3d4-e5f6-7890-abcd-ef1234567894', NULL, 'Tactical Dispositions', 'https://example.com/art-of-war-ch4.mp3', 1650, 2100, 3),
  ('s1b2c3d4-e5f6-7890-abcd-ef12345678a5', 'b1b2c3d4-e5f6-7890-abcd-ef1234567894', NULL, 'Energy', 'https://example.com/art-of-war-ch5.mp3', 2100, 2600, 4),
  ('s1b2c3d4-e5f6-7890-abcd-ef12345678a6', 'b1b2c3d4-e5f6-7890-abcd-ef1234567894', NULL, 'Weak Points and Strong', 'https://example.com/art-of-war-ch6.mp3', 2600, 3000, 5),
  ('s1b2c3d4-e5f6-7890-abcd-ef12345678a7', 'b1b2c3d4-e5f6-7890-abcd-ef1234567894', NULL, 'Maneuvering', 'https://example.com/art-of-war-ch7.mp3', 3000, 3300, 6),
  ('s1b2c3d4-e5f6-7890-abcd-ef12345678a8', 'b1b2c3d4-e5f6-7890-abcd-ef1234567894', NULL, 'Variation in Tactics', 'https://example.com/art-of-war-ch8.mp3', 3300, 3600, 7);

-- ============================================================
-- Sample Audio Alignments (for synchronized reading)
-- ============================================================
INSERT INTO audio_alignments (id, segment_id, book_id, chapter_id, text, start_time, end_time, page_number) VALUES
  -- Meditations Book I alignments
  ('a2b2c3d4-e5f6-7890-abcd-ef1234567891', 's1b2c3d4-e5f6-7890-abcd-ef1234567891', 'b1b2c3d4-e5f6-7890-abcd-ef1234567891', NULL, 'I owe it to the gods to read with attention the writings of my father.', 0, 5.5, 1),
  ('a2b2c3d4-e5f6-7890-abcd-ef1234567892', 's1b2c3d4-e5f6-7890-abcd-ef1234567891', 'b1b2c3d4-e5f6-7890-abcd-ef1234567891', NULL, 'From him I learned to be kind and to change my anger quickly.', 5.5, 10.2, 1),
  ('a2b2c3d4-e5f6-7890-abcd-ef1234567893', 's1b2c3d4-e5f6-7890-abcd-ef1234567891', 'b1b2c3d4-e5f6-7890-abcd-ef1234567891', NULL, 'From the reputation and memory of my father I learned what a man is who is free from ostentation.', 10.2, 17.8, 1),
  ('a2b2c3d4-e5f6-7890-abcd-ef1234567894', 's1b2c3d4-e5f6-7890-abcd-ef1234567891', 'b1b2c3d4-e5f6-7890-abcd-ef1234567891', NULL, 'From my mother I learned piety and generosity and to abstain from all ambition.', 17.8, 24.5, 2),
  ('a2b2c3d4-e5f6-7890-abcd-ef1234567895', 's1b2c3d4-e5f6-7890-abcd-ef1234567891', 'b1b2c3d4-e5f6-7890-abcd-ef1234567891', NULL, 'From my grandfather I learned to avoid the rhetoric of the sophists and to write long speeches.', 24.5, 32.0, 2),
  
  -- Art of War Chapter 1 alignments
  ('a2b2c3d4-e5f6-7890-abcd-ef12345678a1', 's1b2c3d4-e5f6-7890-abcd-ef12345678a1', 'b1b2c3d4-e5f6-7890-abcd-ef1234567894', NULL, 'Sun Tzu said: The art of war is of vital importance to the State.', 0, 4.8, 1),
  ('a2b2c3d4-e5f6-7890-abcd-ef12345678a2', 's1b2c3d4-e5f6-7890-abcd-ef12345678a1', 'b1b2c3d4-e5f6-7890-abcd-ef1234567894', NULL, 'It is a matter of life and death, a road either to survival or ruin.', 4.8, 9.5, 1),
  ('a2b2c3d4-e5f6-7890-abcd-ef12345678a3', 's1b2c3d4-e5f6-7890-abcd-ef12345678a1', 'b1b2c3d4-e5f6-7890-abcd-ef1234567894', NULL, 'It must needs be the subject of careful inquiry.', 9.5, 13.2, 1),
  ('a2b2c3d4-e5f6-7890-abcd-ef12345678a4', 's1b2c3d4-e5f6-7890-abcd-ef12345678a1', 'b1b2c3d4-e5f6-7890-abcd-ef1234567894', NULL, 'War is of the highest importance to the State, the province of life or death, a road either to survival or ruin.', 13.2, 22.0, 2),
  ('a2b2c3d4-e5f6-7890-abcd-ef12345678a5', 's1b2c3d4-e5f6-7890-abcd-ef12345678a1', 'b1b2c3d4-e5f6-7890-abcd-ef1234567894', NULL, 'It is a subject that must not be neglected on any account.', 22.0, 27.5, 2);

-- ============================================================
-- Sample User Preferences (for testing settings persistence)
-- ============================================================
-- Note: These would be created by users; included here for testing
-- INSERT INTO user_preferences (id, user_id, reading_settings, playback_speed, theme) VALUES
--   ('pref-001', '<user-uuid>', '{"fontSize": 18, "lineSpacing": 1.5, "theme": "light", "textAlignment": "left", "margins": 20}', 1.0, 'light');

-- ============================================================
-- Notes
-- ============================================================
-- To create an admin user after signup:
-- UPDATE profiles SET role = 'admin' WHERE email = 'admin@example.com';
--
-- To create a test user:
-- 1. Sign up through the app
-- 2. The profile is auto-created by the trigger
-- 3. Optionally update the role: UPDATE profiles SET role = 'admin' WHERE id = '<user-id>';
