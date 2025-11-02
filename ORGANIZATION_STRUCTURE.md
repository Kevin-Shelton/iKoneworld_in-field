# iK OneWorld - Organizational Structure Design

## Executive Summary

This document outlines a secure, scalable multi-tenant organizational structure for iK OneWorld that supports:
- **Field Sales Teams** (mobile sales representatives)
- **Retail Store Teams** (in-store staff)
- **Department-level organization**
- **Usage metrics and analytics**
- **Secure data access control**
- **Audit trails and compliance**

---

## Database Schema Design

### Core Entities

#### 1. **Organizations** (Top Level)
The root entity representing your company or enterprise.

```sql
organizations
├── id (UUID, primary key)
├── name (string) - "iK OneWorld Inc."
├── subdomain (string, unique) - "ikoneworld" 
├── settings (JSONB) - organization-wide settings
├── created_at (timestamp)
└── updated_at (timestamp)
```

**Purpose**: Multi-tenant support if you ever need to white-label or support multiple companies.

---

#### 2. **Departments**
Logical divisions within the organization (Sales, Retail, Customer Service, etc.)

```sql
departments
├── id (UUID, primary key)
├── organization_id (UUID, foreign key → organizations.id)
├── name (string) - "Field Sales", "Retail Operations"
├── type (enum) - 'field_sales' | 'retail' | 'corporate' | 'support'
├── manager_user_id (UUID, foreign key → users.id)
├── settings (JSONB) - department-specific settings
├── is_active (boolean)
├── created_at (timestamp)
└── updated_at (timestamp)
```

**Purpose**: Group users by functional area for reporting and access control.

---

#### 3. **Stores/Locations**
Physical or virtual locations where retail teams work.

```sql
stores
├── id (UUID, primary key)
├── organization_id (UUID, foreign key → organizations.id)
├── department_id (UUID, foreign key → departments.id)
├── name (string) - "Downtown Store", "Mall Location"
├── store_code (string, unique) - "NYC-001", "LA-MALL-05"
├── type (enum) - 'retail' | 'warehouse' | 'office' | 'virtual'
├── address (JSONB) - {street, city, state, zip, country}
├── manager_user_id (UUID, foreign key → users.id)
├── timezone (string) - "America/New_York"
├── is_active (boolean)
├── created_at (timestamp)
└── updated_at (timestamp)
```

**Purpose**: Track physical locations for retail teams and regional field sales territories.

---

#### 4. **Users** (Enhanced)
Individual user accounts with organizational context.

```sql
users
├── id (UUID, primary key)
├── organization_id (UUID, foreign key → organizations.id)
├── department_id (UUID, nullable, foreign key → departments.id)
├── store_id (UUID, nullable, foreign key → stores.id)
├── email (string, unique)
├── name (string)
├── role (enum) - 'admin' | 'manager' | 'field_sales' | 'retail_staff' | 'viewer'
├── employee_id (string, unique) - "EMP-12345"
├── phone (string)
├── avatar_url (string)
├── is_active (boolean)
├── last_login_at (timestamp)
├── created_at (timestamp)
└── updated_at (timestamp)
```

**Key Points**:
- **Field Sales**: `department_id` set, `store_id` NULL
- **Retail Staff**: Both `department_id` and `store_id` set
- **Managers**: Can oversee multiple stores or departments

---

#### 5. **Conversations** (Enhanced)
Translation conversation sessions with organizational context.

```sql
conversations
├── id (UUID, primary key)
├── organization_id (UUID, foreign key → organizations.id)
├── department_id (UUID, foreign key → departments.id)
├── store_id (UUID, nullable, foreign key → stores.id)
├── user_id (UUID, foreign key → users.id)
├── user_language (string) - "en-US"
├── guest_language (string) - "es-ES"
├── status (enum) - 'active' | 'completed' | 'archived'
├── started_at (timestamp)
├── ended_at (timestamp, nullable)
├── duration_seconds (integer)
├── message_count (integer)
├── metadata (JSONB) - {customer_name, context, tags}
├── created_at (timestamp)
└── updated_at (timestamp)
```

**Purpose**: Track conversation sessions with full organizational context for analytics.

---

#### 6. **Messages** (Enhanced)
Individual messages within conversations with audio storage.

```sql
messages
├── id (UUID, primary key)
├── conversation_id (UUID, foreign key → conversations.id)
├── organization_id (UUID, foreign key → organizations.id)
├── user_id (UUID, foreign key → users.id)
├── original_text (text) - transcribed text
├── translated_text (text) - translation result
├── source_language (string) - "en-US"
├── target_language (string) - "es-ES"
├── audio_url (string, nullable) - Supabase storage URL
├── audio_duration_seconds (integer, nullable)
├── confidence_score (decimal, nullable) - STT confidence 0.0-1.0
├── metadata (JSONB) - {stt_provider, translation_provider}
├── created_at (timestamp)
└── updated_at (timestamp)
```

**Purpose**: Store message content, transcripts, and audio with full traceability.

---

#### 7. **Usage Metrics**
Aggregated usage data for analytics and billing.

```sql
usage_metrics
├── id (UUID, primary key)
├── organization_id (UUID, foreign key → organizations.id)
├── department_id (UUID, nullable, foreign key → departments.id)
├── store_id (UUID, nullable, foreign key → stores.id)
├── user_id (UUID, nullable, foreign key → users.id)
├── metric_date (date) - for daily aggregation
├── conversation_count (integer)
├── message_count (integer)
├── audio_minutes (decimal) - total audio duration
├── storage_bytes (bigint) - total storage used
├── unique_languages (integer) - count of unique language pairs
├── created_at (timestamp)
└── updated_at (timestamp)

-- Unique index to prevent duplicates
UNIQUE INDEX ON (organization_id, department_id, store_id, user_id, metric_date)
```

**Purpose**: Pre-aggregated metrics for fast reporting and dashboards.

---

## Role-Based Access Control (RBAC)

### Role Definitions

| Role | Access Level | Permissions |
|------|-------------|-------------|
| **admin** | Organization-wide | Full access to all data, users, settings |
| **manager** | Department/Store | View and manage assigned department/store data |
| **field_sales** | Personal | Create conversations, view own data only |
| **retail_staff** | Store-level | Create conversations, view store data |
| **viewer** | Read-only | View reports and analytics (no conversations) |

### Access Control Rules

#### Row-Level Security (RLS) Policies

**Conversations Table**:
```sql
-- Users can only see conversations from their organization
CREATE POLICY org_isolation ON conversations
  FOR SELECT
  USING (organization_id = current_user_organization_id());

-- Field sales can only see their own conversations
CREATE POLICY field_sales_own_data ON conversations
  FOR SELECT
  USING (
    user_id = current_user_id() 
    AND current_user_role() = 'field_sales'
  );

-- Retail staff can see all conversations from their store
CREATE POLICY retail_store_data ON conversations
  FOR SELECT
  USING (
    store_id = current_user_store_id()
    AND current_user_role() = 'retail_staff'
  );

-- Managers can see all data from their department
CREATE POLICY manager_department_data ON conversations
  FOR SELECT
  USING (
    department_id = current_user_department_id()
    AND current_user_role() IN ('manager', 'admin')
  );
```

**Messages Table**:
```sql
-- Inherit access from parent conversation
CREATE POLICY message_access ON messages
  FOR SELECT
  USING (
    conversation_id IN (
      SELECT id FROM conversations WHERE <conversation_policies>
    )
  );
```

**Storage Access**:
- Audio files stored in Supabase with path structure: `{org_id}/{dept_id}/{store_id}/{conversation_id}/{message_id}.webm`
- Storage policies match database RLS policies
- Signed URLs with expiration for secure access

---

## Data Isolation & Security

### Multi-Tenant Isolation
1. **Organization ID** is required on every table
2. All queries automatically filter by `organization_id`
3. Database functions enforce current user's organization context
4. No cross-organization data leakage possible

### Audit Trail
```sql
audit_logs
├── id (UUID, primary key)
├── organization_id (UUID)
├── user_id (UUID)
├── action (string) - "conversation.created", "user.updated"
├── resource_type (string) - "conversation", "user"
├── resource_id (UUID)
├── changes (JSONB) - before/after values
├── ip_address (string)
├── user_agent (string)
├── created_at (timestamp)
```

**Purpose**: Complete audit trail for compliance and security investigations.

---

## Usage Metrics & Reporting

### Aggregation Strategy

**Daily Batch Job** (runs at midnight):
```sql
INSERT INTO usage_metrics (organization_id, department_id, store_id, user_id, metric_date, ...)
SELECT 
  organization_id,
  department_id,
  store_id,
  user_id,
  DATE(created_at) as metric_date,
  COUNT(DISTINCT id) as conversation_count,
  SUM(message_count) as message_count,
  SUM(duration_seconds) / 60.0 as audio_minutes,
  -- ... other metrics
FROM conversations
WHERE DATE(created_at) = CURRENT_DATE - INTERVAL '1 day'
GROUP BY organization_id, department_id, store_id, user_id, DATE(created_at);
```

### Reporting Views

**Department Performance**:
```sql
SELECT 
  d.name as department,
  COUNT(DISTINCT c.user_id) as active_users,
  SUM(c.message_count) as total_messages,
  AVG(c.duration_seconds) as avg_conversation_duration
FROM conversations c
JOIN departments d ON c.department_id = d.id
WHERE c.created_at >= NOW() - INTERVAL '30 days'
GROUP BY d.id, d.name;
```

**Store Performance**:
```sql
SELECT 
  s.name as store,
  s.store_code,
  COUNT(c.id) as conversation_count,
  SUM(c.message_count) as message_count
FROM conversations c
JOIN stores s ON c.store_id = s.id
WHERE c.created_at >= NOW() - INTERVAL '7 days'
GROUP BY s.id, s.name, s.store_code;
```

**User Activity**:
```sql
SELECT 
  u.name,
  u.role,
  COUNT(c.id) as conversations,
  SUM(c.duration_seconds) / 60.0 as minutes_used
FROM users u
LEFT JOIN conversations c ON u.id = c.user_id
WHERE c.created_at >= NOW() - INTERVAL '30 days'
GROUP BY u.id, u.name, u.role;
```

---

## Storage Strategy

### Supabase Storage Structure

```
audio-recordings/
├── {organization_id}/
│   ├── {department_id}/
│   │   ├── field-sales/
│   │   │   ├── {user_id}/
│   │   │   │   ├── {conversation_id}/
│   │   │   │   │   ├── {message_id}.webm
│   │   └── retail/
│   │       ├── {store_id}/
│   │       │   ├── {conversation_id}/
│   │       │   │   ├── {message_id}.webm
```

**Benefits**:
- Clear organizational hierarchy
- Easy to calculate storage per department/store
- Simple to implement retention policies
- Supports data export/backup by organization unit

### Retention Policies

| Data Type | Retention Period | Archive Strategy |
|-----------|-----------------|------------------|
| Active conversations | 90 days | Keep in primary database |
| Archived conversations | 1 year | Move to cold storage |
| Audio recordings | 6 months | Delete or move to glacier storage |
| Usage metrics | Forever | Aggregate and compress |
| Audit logs | 7 years | Compliance requirement |

---

## Implementation Recommendations

### Phase 1: Core Structure
1. Create organization, departments, stores tables
2. Update users table with organizational fields
3. Implement RLS policies for data isolation
4. Create helper functions for current user context

### Phase 2: Conversations & Storage
1. Update conversations and messages tables
2. Implement Supabase storage with folder structure
3. Add audio upload functionality
4. Test access control policies

### Phase 3: Metrics & Reporting
1. Create usage_metrics table
2. Implement daily aggregation job
3. Build reporting views and dashboards
4. Add export functionality

### Phase 4: Admin Interface
1. Organization management UI
2. Department and store management
3. User management with role assignment
4. Usage reports and analytics dashboard

---

## Security Best Practices

1. **Never trust client-side data**: Always validate organization/department/store IDs on the server
2. **Use database functions**: Centralize access control logic in PostgreSQL functions
3. **Encrypt sensitive data**: Use Supabase encryption for PII
4. **Signed URLs**: Generate time-limited signed URLs for audio file access
5. **Rate limiting**: Implement per-user and per-organization rate limits
6. **Input validation**: Sanitize all user inputs to prevent SQL injection
7. **Regular audits**: Review access logs and unusual activity patterns

---

## Questions to Consider

1. **Hierarchy depth**: Do you need regions above stores? (e.g., West Coast → California → Los Angeles → Store)
2. **User mobility**: Can field sales move between departments? Should we track history?
3. **Guest access**: Do customers need temporary access to view their conversation history?
4. **Data residency**: Any requirements for data to stay in specific geographic regions?
5. **Billing model**: Will you charge per user, per conversation, or per storage used?

---

## Next Steps

Once you approve this structure, I will:
1. Create database migration scripts
2. Implement RLS policies in Supabase
3. Update the application code to use this structure
4. Build admin interfaces for organization management
5. Create usage reporting dashboards

Please review and let me know if you'd like any modifications to this design!
