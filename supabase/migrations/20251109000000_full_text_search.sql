-- =====================================================
-- EODH – Full-Text Search Optimization Migration
-- Adds search function and optimizes search performance
-- =====================================================

-- =====================================================
-- 1. CREATE SEARCH FUNCTION
-- =====================================================

CREATE OR REPLACE FUNCTION search_books(
  p_query TEXT,
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  book_id UUID,
  book_title TEXT,
  book_author TEXT,
  book_cover_url TEXT,
  chapter_id UUID,
  chapter_title TEXT,
  snippet TEXT,
  rank DOUBLE PRECISION
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    b.id AS book_id,
    b.title AS book_title,
    b.author AS book_author,
    b.cover_url AS book_cover_url,
    bc.id AS chapter_id,
    bc.title AS chapter_title,
    ts_headline('english', COALESCE(bc.content, ''), websearch_to_tsquery('english', p_query),
      'StartSel=<mark>,StopSel=</mark>,MaxWords=50,MinWords=20,MaxFragments=1,FragmentDelimiter= ... ') AS snippet,
    ts_rank_cd(to_tsvector('english', COALESCE(bc.content, '')), websearch_to_tsquery('english', p_query)) AS rank
  FROM book_chapters bc
  JOIN books b ON b.id = bc.book_id
  WHERE b.is_published = true
    AND to_tsvector('english', COALESCE(bc.content, '')) @@ websearch_to_tsquery('english', p_query)
  UNION ALL
  SELECT
    b.id AS book_id,
    b.title AS book_title,
    b.author AS book_author,
    b.cover_url AS book_cover_url,
    NULL::UUID AS chapter_id,
    b.title AS chapter_title,
    ts_headline('english', COALESCE(b.description, ''), websearch_to_tsquery('english', p_query),
      'StartSel=<mark>,StopSel=</mark>,MaxWords=50,MinWords=20,MaxFragments=1,FragmentDelimiter= ... ') AS snippet,
    ts_rank_cd(to_tsvector('english', COALESCE(b.description, '')), websearch_to_tsquery('english', p_query)) AS rank
  FROM books b
  WHERE b.is_published = true
    AND b.description IS NOT NULL
    AND to_tsvector('english', b.description) @@ websearch_to_tsquery('english', p_query)
    AND NOT EXISTS (
      SELECT 1 FROM book_chapters bc2 WHERE bc2.book_id = b.id
        AND to_tsvector('english', COALESCE(bc2.content, '')) @@ websearch_to_tsquery('english', p_query)
    )
  ORDER BY rank DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 2. CREATE SEARCH FUNCTION FOR TITLE/AUTHOR SEARCH
-- =====================================================

CREATE OR REPLACE FUNCTION search_books_by_metadata(
  p_query TEXT,
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  book_id UUID,
  book_title TEXT,
  book_author TEXT,
  book_cover_url TEXT,
  chapter_id UUID,
  chapter_title TEXT,
  snippet TEXT,
  rank DOUBLE PRECISION
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    b.id AS book_id,
    b.title AS book_title,
    b.author AS book_author,
    b.cover_url AS book_cover_url,
    NULL::UUID AS chapter_id,
    b.title AS chapter_title,
    ts_headline('english', COALESCE(b.title || ' ' || b.author, ''), websearch_to_tsquery('english', p_query),
      'StartSel=<mark>,StopSel=</mark>,MaxWords=50,MinWords=20,MaxFragments=1,FragmentDelimiter= ... ') AS snippet,
    ts_rank_cd(to_tsvector('english', COALESCE(b.title || ' ' || b.author, '')), websearch_to_tsquery('english', p_query)) AS rank
  FROM books b
  WHERE b.is_published = true
    AND (
      to_tsvector('english', b.title) @@ websearch_to_tsquery('english', p_query)
      OR to_tsvector('english', b.author) @@ websearch_to_tsquery('english', p_query)
    )
  ORDER BY rank DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 3. CREATE COMBINED SEARCH FUNCTION (CONTENT + METADATA)
-- =====================================================

CREATE OR REPLACE FUNCTION search_all_books(
  p_query TEXT,
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  book_id UUID,
  book_title TEXT,
  book_author TEXT,
  book_cover_url TEXT,
  chapter_id UUID,
  chapter_title TEXT,
  snippet TEXT,
  rank DOUBLE PRECISION
) AS $$
BEGIN
  RETURN QUERY
  WITH content_matches AS (
    SELECT
      b.id AS book_id,
      b.title AS book_title,
      b.author AS book_author,
      b.cover_url AS book_cover_url,
      bc.id AS chapter_id,
      bc.title AS chapter_title,
      ts_headline('english', COALESCE(bc.content, ''), websearch_to_tsquery('english', p_query),
        'StartSel=<mark>,StopSel=</mark>,MaxWords=50,MinWords=20,MaxFragments=1,FragmentDelimiter= ... ') AS snippet,
      ts_rank_cd(to_tsvector('english', COALESCE(bc.content, '')), websearch_to_tsquery('english', p_query)) AS rank
    FROM book_chapters bc
    JOIN books b ON b.id = bc.book_id
    WHERE b.is_published = true
      AND to_tsvector('english', COALESCE(bc.content, '')) @@ websearch_to_tsquery('english', p_query)
  ),
  metadata_matches AS (
    SELECT
      b.id AS book_id,
      b.title AS book_title,
      b.author AS book_author,
      b.cover_url AS book_cover_url,
      NULL::UUID AS chapter_id,
      b.title AS chapter_title,
      ts_headline('english', COALESCE(b.title || ' ' || b.author || ' ' || b.description, ''), websearch_to_tsquery('english', p_query),
        'StartSel=<mark>,StopSel=</mark>,MaxWords=50,MinWords=20,MaxFragments=1,FragmentDelimiter= ... ') AS snippet,
      ts_rank_cd(to_tsvector('english', COALESCE(b.title || ' ' || b.author || ' ' || b.description, '')), websearch_to_tsquery('english', p_query)) AS rank
    FROM books b
    WHERE b.is_published = true
      AND (
        to_tsvector('english', b.title) @@ websearch_to_tsquery('english', p_query)
        OR to_tsvector('english', b.author) @@ websearch_to_tsquery('english', p_query)
        OR (b.description IS NOT NULL AND to_tsvector('english', b.description) @@ websearch_to_tsquery('english', p_query))
      )
  )
  SELECT * FROM content_matches
  UNION ALL
  SELECT * FROM metadata_matches
  ORDER BY rank DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 4. ADD GIN INDEXES FOR FULL-TEXT SEARCH
-- =====================================================

-- Index for book_chapters content (already exists in migration, but ensure it's here)
CREATE INDEX IF NOT EXISTS idx_chapters_content_fts ON book_chapters
  USING gin(to_tsvector('english', COALESCE(content, '')));

-- Index for books title
CREATE INDEX IF NOT EXISTS idx_books_title_fts ON books
  USING gin(to_tsvector('english', title));

-- Index for books author
CREATE INDEX IF NOT EXISTS idx_books_author_fts ON books
  USING gin(to_tsvector('english', author));

-- Index for books description
CREATE INDEX IF NOT EXISTS idx_books_description_fts ON books
  USING gin(to_tsvector('english', COALESCE(description, '')));

-- =====================================================
-- 5. GRANT EXECUTE PERMISSIONS TO ANON (for guest search)
-- =====================================================

GRANT EXECUTE ON FUNCTION search_books(TEXT, INTEGER) TO anon;
GRANT EXECUTE ON FUNCTION search_books_by_metadata(TEXT, INTEGER) TO anon;
GRANT EXECUTE ON FUNCTION search_all_books(TEXT, INTEGER) TO anon;

GRANT EXECUTE ON FUNCTION search_books(TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION search_books_by_metadata(TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION search_all_books(TEXT, INTEGER) TO authenticated;
