# iK OneWorld - Database Setup Guide

## Overview

This guide walks you through setting up the enterprise multi-tenant database structure for iK OneWorld in Supabase.

---

## Prerequisites

1. **Supabase Account**: Sign up at https://supabase.com
2. **Supabase Project**: Create a new project or use an existing one
3. **SQL Editor Access**: You'll run SQL scripts in the Supabase SQL Editor

---

## Setup Steps

### Step 1: Run Base Schema

1. Go to your Supabase project dashboard
2. Click **SQL Editor** in the left sidebar
3. Click **"New query"**
4. Copy the contents of `supabase-schema.sql`
5. Paste into the SQL Editor
6. Click **"Run"** or press `Ctrl+Enter`
7. Wait for "Database schema created successfully!" message

**What this does:**
- Creates base tables: users, languages, conversations, messages
- Sets up language metadata tables (STT, TTS, TTT)
- Creates indexes for performance
- Adds updated_at triggers

---

### Step 2: Run Enterprise Multi-Tenant Schema

1. In SQL Editor, click **"New query"**
2. Copy the contents of `supabase-schema-v2-enterprise.sql`
3. Paste into the SQL Editor
4. Click **"Run"**
5. Wait for "✅ Enterprise multi-tenant schema created successfully!" message

**What this does:**
- Creates organizational hierarchy tables (enterprises, regions, states, cities, districts, stores)
- Adds departments table for functional divisions
- Updates users table with enterprise fields
- Creates user_assignments for multi-role support
- Updates conversations with full hierarchy tracking
- Creates billing_records and invoices tables
- Sets up Row Level Security (RLS) policies
- Creates helper functions and triggers

---

### Step 3: Run Seed Data (Optional - for testing)

1. In SQL Editor, click **"New query"**
2. Copy the contents of `supabase-seed-data-enterprise.sql`
3. Paste into the SQL Editor
4. Click **"Run"**
5. Wait for "✅ Seed data created successfully!" message

**What this creates:**
- 1 test enterprise: "Demo Retail Corp"
- 3 regions (West Coast, Northeast, Southeast)
- 5 states (CA, OR, NY, MA, FL)
- 5 cities
- 6 districts
- 5 stores
- 3 departments
- 6 test users with different roles

---

### Step 4: Populate Language Data

1. In SQL Editor, click **"New query"**
2. Copy the contents of `supabase-data.sql`
3. Paste into the SQL Editor
4. Click **"Run"**

**What this does:**
- Populates supported languages for STT, TTS, and translation
- Adds language metadata (names, codes, directions)

---

## Verify Setup

Run these queries to verify everything is set up correctly:

```sql
-- Check enterprises
SELECT * FROM enterprises;

-- Check organizational hierarchy
SELECT 
    r.name as region,
    s.name as state,
    c.name as city,
    d.name as district,
    st.store_code,
    st.name as store_name
FROM stores st
JOIN districts d ON st.district_id = d.id
JOIN cities c ON d.city_id = c.id
JOIN states s ON c.state_id = s.id
JOIN regions r ON s.region_id = r.id
ORDER BY r.name, s.name, c.name, d.name, st.store_code;

-- Check users and their assignments
SELECT 
    u.name,
    u.enterprise_role,
    u.employee_id,
    ua.assignment_type,
    ua.role_in_assignment,
    ua.is_primary
FROM users u
LEFT JOIN user_assignments ua ON u.id = ua.user_id
WHERE u.enterprise_id IS NOT NULL
ORDER BY u.id, ua.is_primary DESC;
```

---

## Next Steps

### 1. Configure Application Environment Variables

Add these to your `.env.local` file and Vercel environment variables:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Default Enterprise (for development)
NEXT_PUBLIC_DEFAULT_ENTERPRISE_ID=00000000-0000-0000-0000-000000000001
```

### 2. Set Up Supabase Storage

1. Go to **Storage** in Supabase dashboard
2. Click **"New bucket"**
3. Name: `audio-recordings`
4. Public: **ON**
5. Click **"Create bucket"**

### 3. Configure Storage Policies

```sql
-- Allow public read access to audio files
CREATE POLICY "Public read access"
ON storage.objects FOR SELECT
USING (bucket_id = 'audio-recordings');

-- Allow authenticated users to upload
CREATE POLICY "Authenticated users can upload"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'audio-recordings' 
    AND auth.role() = 'authenticated'
);

-- Allow users to delete their own uploads
CREATE POLICY "Users can delete own uploads"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'audio-recordings'
    AND auth.uid()::text = (storage.foldername(name))[1]
);
```

---

## Understanding the Structure

### Enterprise Hierarchy

```
Enterprise (Demo Retail Corp)
├── Region (West Coast)
│   ├── State (California)
│   │   ├── City (Los Angeles)
│   │   │   ├── District (Downtown LA)
│   │   │   │   ├── Store (Main Street - LA-001)
│   │   │   │   └── Store (Grand Avenue - LA-002)
│   │   │   └── District (West LA)
│   │   │       └── Store (Santa Monica - LA-003)
│   │   └── City (San Francisco)
│   └── State (Oregon)
└── Region (Northeast)
    └── State (New York)
        └── City (New York City)
            ├── District (Manhattan)
            │   └── Store (Times Square - NYC-001)
            └── District (Brooklyn)
                └── Store (Williamsburg - NYC-002)
```

### User Roles & Access

| Role | Access Level | Example |
|------|-------------|---------|
| `enterprise_admin` | All data in enterprise | Admin User |
| `regional_director` | All data in assigned region(s) | Sarah Johnson (West Coast) |
| `district_manager` | All data in assigned district(s) | Mike Chen (Downtown LA) |
| `store_manager` | All data in assigned store(s) | Emily Rodriguez (2 stores) |
| `retail_staff` | Own conversations + store data (read) | James Wilson |
| `field_sales` | Only own conversations | Lisa Martinez |

### Multi-Assignment Example

Emily Rodriguez (Store Manager) is assigned to:
- **Primary**: Main Street Store (LA-001) as "Store Manager"
- **Secondary**: Grand Avenue Store (LA-002) as "Acting Store Manager"

She can:
- Create conversations at either store
- View all conversations from both stores
- Manage staff at both locations

---

## Troubleshooting

### Error: "relation already exists"

**Solution**: Tables already exist. Either:
1. Drop existing tables first (⚠️ deletes all data)
2. Skip to next step if tables are correct

### Error: "permission denied"

**Solution**: Make sure you're running queries as the database owner (postgres role)

### RLS Policies Not Working

**Solution**: 
1. Verify RLS is enabled: `ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;`
2. Check that `app.current_enterprise_id` is set in your application
3. Test with: `SELECT current_user_enterprise_id();`

### Can't See Data After Insert

**Solution**: RLS policies are blocking access. Either:
1. Temporarily disable RLS for testing: `ALTER TABLE table_name DISABLE ROW LEVEL SECURITY;`
2. Set the correct enterprise context in your application

---

## Support

For issues or questions:
1. Check the Supabase documentation: https://supabase.com/docs
2. Review the schema files for comments and explanations
3. Test queries in the SQL Editor to debug access issues

---

## Schema Files Reference

| File | Purpose | Run Order |
|------|---------|-----------|
| `supabase-schema.sql` | Base tables and language metadata | 1st |
| `supabase-schema-v2-enterprise.sql` | Enterprise multi-tenant structure | 2nd |
| `supabase-seed-data-enterprise.sql` | Test data (optional) | 3rd |
| `supabase-data.sql` | Language data | 4th |

---

**✅ Setup complete!** You now have a fully functional enterprise multi-tenant database ready for iK OneWorld.
