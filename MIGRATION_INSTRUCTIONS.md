# Database Migration Instructions

## User Favorite Languages Table

A new table `user_favorite_languages` has been added to store user-specific favorite languages.

### Migration File

`drizzle/0003_add_user_favorite_languages.sql`

### How to Run the Migration

#### Option 1: Using Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Create a new query
4. Copy and paste the contents of `drizzle/0003_add_user_favorite_languages.sql`
5. Click **Run** to execute the migration

#### Option 2: Using Drizzle Kit

```bash
# Generate migration
pnpm drizzle-kit generate:pg

# Push to database
pnpm drizzle-kit push:pg
```

#### Option 3: Using psql

```bash
psql $DATABASE_URL -f drizzle/0003_add_user_favorite_languages.sql
```

### Verification

After running the migration, verify the table was created:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_name = 'user_favorite_languages';
```

You should see one row returned with the table name.

### What This Enables

- Users can mark languages as favorites
- Favorites are stored per user (not global)
- Favorites appear at the top of the language selection page
- Star icon to add/remove favorites
- Persists across sessions

### Rollback (if needed)

If you need to remove this table:

```sql
DROP TABLE IF EXISTS "user_favorite_languages";
```
