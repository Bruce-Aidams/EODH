-- EODH Development Seed Data
-- Run this script after the main schema to populate development/test data
-- This is for development only — do not run in production

-- ============================================================
-- Book Categories
-- ============================================================
INSERT INTO book_categories (id, name, description) VALUES
  ('cat-001', 'Philosophy', 'Philosophical works and treatises'),
  ('cat-002', 'Theology', 'Theological studies and religious texts'),
  ('cat-003', 'Science', 'Scientific literature and research'),
  ('cat-004', 'Literature', 'Fiction, poetry, and literary works'),
  ('cat-005', 'History', 'Historical accounts and biographies'),
  ('cat-006', 'Self-Help', 'Personal development and improvement'),
  ('cat-007', 'Technology', 'Technology and computer science'),
  ('cat-008', 'Reference', 'Reference materials and encyclopedias');

-- ============================================================
-- Sample Books
-- ============================================================
INSERT INTO books (id, title, author, description, category_id, language, publication_date, document_type, document_url, cover_url, is_published, created_by) VALUES
  ('book-001', 
   'Meditations', 
   'Marcus Aurelius', 
   'Personal writings of Roman Emperor Marcus Aurelius. A work of practical philosophy written in military camps, offering guidance on self-improvement, duty, and the nature of the universe.',
   'cat-001', 'en', '180-01-01', 'markdown', 'https://example.com/meditations.md', NULL, true, NULL),
  
  ('book-002', 
   'The Republic', 
   'Plato', 
   'A Socratic dialogue concerning justice, the order and character of the just city-state, and the just man. One of the most influential works of philosophy and political theory.',
   'cat-001', 'en', '-380-01-01', 'markdown', 'https://example.com/republic.md', NULL, true, NULL),
  
  ('book-003', 
   'A Brief History of Time', 
   'Stephen Hawking', 
   'A landmark volume in science writing that explores the nature of space, time, and the universe. From the Big Bang to black holes, Hawking makes complex concepts accessible.',
   'cat-003', 'en', '1988-04-01', 'pdf', 'https://example.com/brief-history.pdf', NULL, true, NULL),
  
  ('book-004', 
   'The Art of War', 
   'Sun Tzu', 
   'An ancient Chinese military treatise dating from the Late Spring and Autumn Period. The work is attributed to the general Sun Tzu and remains influential in military strategy and business.',
   'cat-005', 'en', '-500-01-01', 'markdown', 'https://example.com/art-of-war.md', NULL, true, NULL),
  
  ('book-005', 
   'Thinking, Fast and Slow', 
   'Daniel Kahneman', 
   'A tour of the two systems that drive the way we think. System 1 is fast, intuitive, and emotional; System 2 is slower, more deliberative, and more logical.',
   'cat-006', 'en', '2011-10-01', 'pdf', 'https://example.com/thinking-fast-slow.pdf', NULL, true, NULL),
  
  ('book-006', 
   'Pride and Prejudice', 
   'Jane Austen', 
   'A romantic novel of manners that follows the character development of Elizabeth Bennet, the dynamic protagonist who learns about the repercussions of hasty judgments.',
   'cat-004', 'en', '1813-01-28', 'markdown', 'https://example.com/pride-prejudice.md', NULL, true, NULL);

-- ============================================================
-- Sample Audiobooks
-- ============================================================
INSERT INTO audio_books (id, book_id, narrator, audio_format, total_duration) VALUES
  ('audio-001', 'book-001', 'AI Narrator', 'mp3', 7200),
  ('audio-002', 'book-004', 'AI Narrator', 'mp3', 3600);

-- ============================================================
-- Sample Audio Segments (Chapters)
-- ============================================================
INSERT INTO audio_segments (id, audio_book_id, chapter_id, title, audio_file_url, order_index, duration, start_time, end_time) VALUES
  ('seg-001', 'audio-001', 'chapter-1', 'Book I: On the Governing Mind', 'https://example.com/meditations-ch1.mp3', 0, 1200, 0, 1200),
  ('seg-002', 'audio-001', 'chapter-2', 'Book II: On the Place and the Matter', 'https://example.com/meditations-ch2.mp3', 1, 1100, 1200, 2300),
  ('seg-003', 'audio-001', 'chapter-3', 'Book III: On the Derived and the Inherent Good', 'https://example.com/meditations-ch3.mp3', 2, 1300, 2300, 3600),
  ('seg-004', 'audio-001', 'chapter-4', 'Book IV: On the Inner Citadel', 'https://example.com/meditations-ch4.mp3', 3, 1400, 3600, 5000),
  ('seg-005', 'audio-001', 'chapter-5', 'Book V: On the Ephemeral and the Unknown', 'https://example.com/meditations-ch5.mp3', 4, 1200, 5000, 6200),
  ('seg-006', 'audio-001', 'chapter-6', 'Book VI: The Heraclitean Theory', 'https://example.com/meditations-ch6.mp3', 5, 1000, 6200, 7200),
  
  ('seg-010', 'audio-002', 'chapter-1', 'Laying Plans', 'https://example.com/art-of-war-ch1.mp3', 0, 600, 0, 600),
  ('seg-011', 'audio-002', 'chapter-2', 'Waging War', 'https://example.com/art-of-war-ch2.mp3', 1, 500, 600, 1100),
  ('seg-012', 'audio-002', 'chapter-3', 'Attack by Stratagem', 'https://example.com/art-of-war-ch3.mp3', 2, 550, 1100, 1650),
  ('seg-013', 'audio-002', 'chapter-4', 'Tactical Dispositions', 'https://example.com/art-of-war-ch4.mp3', 3, 450, 1650, 2100),
  ('seg-014', 'audio-002', 'chapter-5', 'Energy', 'https://example.com/art-of-war-ch5.mp3', 4, 500, 2100, 2600),
  ('seg-015', 'audio-002', 'chapter-6', 'Weak Points and Strong', 'https://example.com/art-of-war-ch6.mp3', 5, 400, 2600, 3000),
  ('seg-016', 'audio-002', 'chapter-7', 'Maneuvering', 'https://example.com/art-of-war-ch7.mp3', 6, 300, 3000, 3300),
  ('seg-017', 'audio-002', 'chapter-8', 'Variation in Tactics', 'https://example.com/art-of-war-ch8.mp3', 7, 300, 3300, 3600);

-- ============================================================
-- Sample Audio Alignments (for synchronized reading)
-- ============================================================
INSERT INTO audio_alignments (id, segment_id, book_id, chapter_id, text, start_time, end_time, page_number) VALUES
  -- Meditations Book I alignments
  ('align-001', 'seg-001', 'book-001', 'chapter-1', 'I owe it to the gods to read with attention the writings of my father.', 0, 5.5, 1),
  ('align-002', 'seg-001', 'book-001', 'chapter-1', 'From him I learned to be kind and to change my anger quickly.', 5.5, 10.2, 1),
  ('align-003', 'seg-001', 'book-001', 'chapter-1', 'From the reputation and memory of my father I learned what a man is who is free from ostentation.', 10.2, 17.8, 1),
  ('align-004', 'seg-001', 'book-001', 'chapter-1', 'From my mother I learned piety and generosity and to abstain from all ambition.', 17.8, 24.5, 2),
  ('align-005', 'seg-001', 'book-001', 'chapter-1', 'From my grandfather I learned to avoid the rhetoric of the sophists and to write long speeches.', 24.5, 32.0, 2),
  
  -- Art of War Chapter 1 alignments
  ('align-010', 'seg-010', 'book-004', 'chapter-1', 'Sun Tzu said: The art of war is of vital importance to the State.', 0, 4.8, 1),
  ('align-011', 'seg-010', 'book-004', 'chapter-1', 'It is a matter of life and death, a road either to survival or ruin.', 4.8, 9.5, 1),
  ('align-012', 'seg-010', 'book-004', 'chapter-1', 'It must needs be the subject of careful inquiry.', 9.5, 13.2, 1),
  ('align-013', 'seg-010', 'book-004', 'chapter-1', 'War is of the highest importance to the State, the province of life or death, a road either to survival or ruin.', 13.2, 22.0, 2),
  ('align-014', 'seg-010', 'book-004', 'chapter-1', 'It is a subject that must not be neglected on any account.', 22.0, 27.5, 2);

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
