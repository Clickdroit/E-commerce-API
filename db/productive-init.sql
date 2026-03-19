-- This script creates the 'productive' database for the Productive Dashboard.
-- It runs automatically on first postgres initialization.
-- If your postgres volume already exists, run manually:
--   docker exec ecommerce_postgres psql -U <POSTGRES_USER> -c "CREATE DATABASE productive;"
CREATE DATABASE productive;
