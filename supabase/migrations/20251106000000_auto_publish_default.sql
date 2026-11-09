-- Change is_published default to true so newly uploaded books are auto-published
ALTER TABLE books ALTER COLUMN is_published SET DEFAULT true;
