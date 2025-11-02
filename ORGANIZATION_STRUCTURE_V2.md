# iK OneWorld - Enterprise Multi-Tenant Organizational Structure V2

## Executive Summary

Updated design for iK OneWorld as a **multi-tenant SaaS platform** supporting enterprise clients with complex retail and field sales structures. Based on research of large retail chains, this architecture supports:

- **Enterprise-level accounts** (your clients like major retailers/telcos)
- **6-level geographic hierarchy** (Enterprise → Region → State → City → District → Store)
- **Multi-role users** (regional managers, executives operating across multiple units)
- **Per-conversation billing** with multi-level rollup
- **Flexible reassignment** without history tracking
- **Scalable from 10 to 100,000+ users**

---

## Key Insights from Research

### Typical Enterprise Retail/Sales Hierarchy

Based on major retail chains and telecommunications companies:

```
Level 1: Corporate/Enterprise (CEO, COO, CFO)
Level 2: Regional Directors/VPs (e.g., "West Coast", "Northeast")
Level 3: Area/State Managers (e.g., "California", "New York")
Level 4: District Managers (e.g., "Los Angeles Metro", "NYC Borough")
Level 5: Store/Territory Managers (individual locations or sales territories)
Level 6: Staff (retail associates, field sales reps)
```

**Common patterns:**
- Regional Director manages 10-20 District Managers
- District Manager manages 8-15 stores
- Store Manager manages 10-50 staff
- Field Sales Executives may cover multiple states
- Regional Managers have cross-functional access

---

## Updated Database Schema

### 1. **Enterprises** (Your SaaS Customers)
The top-level tenant - your enterprise clients.

```sql
enterprises
├── id (UUID, primary key)
├── name (string) - "RetailCorp Inc.", "TelcoGlobal"
├── slug (string, unique) - "retailcorp", "telcoglobal"
├── industry (enum) - 'retail' | 'telecommunications' | 'hospitality' | 'other'
├── subscription_tier (enum) - 'starter' | 'professional' | 'enterprise'
├── billing_email (string)
├── billing_status (enum) - 'active' | 'suspended' | 'trial'
├── max_users (integer, nullable) - null = unlimited
├── max_conversations_per_month (integer, nullable)
├── settings (JSONB) - {branding, features, limits}
├── is_active (boolean)
├── trial_ends_at (timestamp, nullable)
├── created_at (timestamp)
└── updated_at (timestamp)
```

**Purpose**: Multi-tenant isolation - each enterprise is a separate customer.

---

### 2. **Regions** (Geographic Level 1)
Large geographic divisions (e.g., "West Coast", "Northeast", "International")

```sql
regions
├── id (UUID, primary key)
├── enterprise_id (UUID, foreign key → enterprises.id)
├── name (string) - "West Coast Region", "Northeast Region"
├── code (string) - "WEST", "NE", "INTL"
├── director_user_id (UUID, nullable, foreign key → users.id)
├── settings (JSONB)
├── is_active (boolean)
├── created_at (timestamp)
└── updated_at (timestamp)
```

---

### 3. **States** (Geographic Level 2)
State or province level divisions.

```sql
states
├── id (UUID, primary key)
├── enterprise_id (UUID, foreign key → enterprises.id)
├── region_id (UUID, foreign key → regions.id)
├── name (string) - "California", "New York"
├── code (string) - "CA", "NY" (ISO 3166-2)
├── country_code (string) - "US", "CA", "MX"
├── manager_user_id (UUID, nullable, foreign key → users.id)
├── is_active (boolean)
├── created_at (timestamp)
└── updated_at (timestamp)
```

---

### 4. **Cities** (Geographic Level 3)
City or metro area divisions.

```sql
cities
├── id (UUID, primary key)
├── enterprise_id (UUID, foreign key → enterprises.id)
├── state_id (UUID, foreign key → states.id)
├── name (string) - "Los Angeles", "San Francisco"
├── timezone (string) - "America/Los_Angeles"
├── manager_user_id (UUID, nullable, foreign key → users.id)
├── is_active (boolean)
├── created_at (timestamp)
└── updated_at (timestamp)
```

---

### 5. **Districts** (Geographic Level 4)
District or area divisions (multiple stores/territories).

```sql
districts
├── id (UUID, primary key)
├── enterprise_id (UUID, foreign key → enterprises.id)
├── city_id (UUID, foreign key → cities.id)
├── name (string) - "Downtown LA", "West LA", "Brooklyn"
├── code (string) - "LA-DT", "LA-W", "NYC-BK"
├── manager_user_id (UUID, nullable, foreign key → users.id)
├── is_active (boolean)
├── created_at (timestamp)
└── updated_at (timestamp)
```

---

### 6. **Stores** (Geographic Level 5)
Individual retail locations or field sales territories.

```sql
stores
├── id (UUID, primary key)
├── enterprise_id (UUID, foreign key → enterprises.id)
├── district_id (UUID, foreign key → districts.id)
├── name (string) - "Main Street Store", "Airport Location"
├── store_code (string, unique within enterprise) - "LA-001", "NYC-042"
├── type (enum) - 'retail_store' | 'sales_territory' | 'kiosk' | 'warehouse'
├── address (JSONB) - {street, city, state, zip, country, lat, lng}
├── phone (string)
├── manager_user_id (UUID, nullable, foreign key → users.id)
├── timezone (string)
├── is_active (boolean)
├── opened_at (timestamp, nullable)
├── created_at (timestamp)
└── updated_at (timestamp)
```

---

### 7. **Departments** (Functional Divisions)
Cross-cutting functional areas (can span multiple geographic units).

```sql
departments
├── id (UUID, primary key)
├── enterprise_id (UUID, foreign key → enterprises.id)
├── name (string) - "Field Sales", "Retail Operations", "Customer Service"
├── type (enum) - 'field_sales' | 'retail' | 'support' | 'corporate'
├── head_user_id (UUID, nullable, foreign key → users.id)
├── settings (JSONB)
├── is_active (boolean)
├── created_at (timestamp)
└── updated_at (timestamp)
```

**Purpose**: Separate from geography - allows "Field Sales" to operate across all regions.

---

### 8. **Users** (Enhanced for Multi-Assignment)
Individual user accounts with flexible organizational assignment.

```sql
users
├── id (UUID, primary key)
├── enterprise_id (UUID, foreign key → enterprises.id)
├── email (string, unique)
├── name (string)
├── employee_id (string, unique within enterprise)
├── role (enum) - 'enterprise_admin' | 'regional_director' | 'area_manager' 
│                 | 'district_manager' | 'store_manager' | 'field_sales' 
│                 | 'retail_staff' | 'viewer'
├── primary_department_id (UUID, nullable, foreign key → departments.id)
├── primary_store_id (UUID, nullable, foreign key → stores.id)
├── phone (string)
├── avatar_url (string)
├── is_active (boolean)
├── last_login_at (timestamp)
├── created_at (timestamp)
└── updated_at (timestamp)
```

**Note**: Primary assignments only. Multi-assignments handled in junction table below.

---

### 9. **User Assignments** (Many-to-Many)
Allows users to operate across multiple organizational units.

```sql
user_assignments
├── id (UUID, primary key)
├── user_id (UUID, foreign key → users.id)
├── assignment_type (enum) - 'region' | 'state' | 'city' | 'district' | 'store' | 'department'
├── assignment_id (UUID) - polymorphic reference to region/state/city/district/store/department
├── role_in_assignment (string) - "Regional Manager", "Acting Store Manager"
├── is_primary (boolean) - one primary assignment per type
├── assigned_at (timestamp)
├── created_at (timestamp)
└── updated_at (timestamp)

-- Unique constraint: user can't have duplicate assignments
UNIQUE INDEX ON (user_id, assignment_type, assignment_id)
```

**Examples**:
- Regional Manager: Assigned to `region_id=123` with type='region'
- Store Manager covering 2 stores: Two rows with type='store', different store IDs
- Field Sales Executive: Assigned to multiple states

---

### 10. **Conversations** (Enhanced with Full Hierarchy)
Translation sessions with complete organizational context.

```sql
conversations
├── id (UUID, primary key)
├── enterprise_id (UUID, foreign key → enterprises.id)
├── user_id (UUID, foreign key → users.id)
├── department_id (UUID, nullable, foreign key → departments.id)
├── store_id (UUID, nullable, foreign key → stores.id)
├── district_id (UUID, nullable, foreign key → districts.id)
├── city_id (UUID, nullable, foreign key → cities.id)
├── state_id (UUID, nullable, foreign key → states.id)
├── region_id (UUID, nullable, foreign key → regions.id)
├── user_language (string) - "en-US"
├── guest_language (string) - "es-ES"
├── status (enum) - 'active' | 'completed' | 'archived'
├── started_at (timestamp)
├── ended_at (timestamp, nullable)
├── duration_seconds (integer)
├── message_count (integer)
├── billing_status (enum) - 'pending' | 'billed' | 'free_tier'
├── billed_at (timestamp, nullable)
├── metadata (JSONB) - {customer_name, context, tags, location}
├── created_at (timestamp)
└── updated_at (timestamp)

-- Indexes for reporting
CREATE INDEX idx_conv_enterprise_date ON conversations(enterprise_id, created_at);
CREATE INDEX idx_conv_store_date ON conversations(store_id, created_at);
CREATE INDEX idx_conv_billing ON conversations(enterprise_id, billing_status, created_at);
```

**Auto-populate hierarchy**: When a conversation is created with `store_id`, automatically populate `district_id`, `city_id`, `state_id`, `region_id` via database trigger.

---

### 11. **Messages** (No changes from V1)
```sql
messages
├── id (UUID, primary key)
├── conversation_id (UUID, foreign key → conversations.id)
├── enterprise_id (UUID, foreign key → enterprises.id)
├── user_id (UUID, foreign key → users.id)
├── original_text (text)
├── translated_text (text)
├── source_language (string)
├── target_language (string)
├── audio_url (string, nullable)
├── audio_duration_seconds (integer, nullable)
├── confidence_score (decimal, nullable)
├── metadata (JSONB)
├── created_at (timestamp)
└── updated_at (timestamp)
```

---

### 12. **Billing Records** (Per-Conversation Billing)
Track billable conversations for invoicing.

```sql
billing_records
├── id (UUID, primary key)
├── enterprise_id (UUID, foreign key → enterprises.id)
├── conversation_id (UUID, foreign key → conversations.id)
├── billing_period_start (date)
├── billing_period_end (date)
├── conversation_date (date)
├── user_id (UUID, foreign key → users.id)
├── store_id (UUID, nullable)
├── district_id (UUID, nullable)
├── city_id (UUID, nullable)
├── state_id (UUID, nullable)
├── region_id (UUID, nullable)
├── department_id (UUID, nullable)
├── message_count (integer)
├── duration_seconds (integer)
├── unit_price (decimal) - price per conversation
├── amount (decimal) - calculated amount
├── currency (string) - "USD"
├── invoice_id (UUID, nullable, foreign key → invoices.id)
├── created_at (timestamp)
└── updated_at (timestamp)

-- Index for rollup queries
CREATE INDEX idx_billing_rollup ON billing_records(
  enterprise_id, billing_period_start, region_id, state_id, city_id, district_id, store_id
);
```

---

### 13. **Invoices** (Monthly Billing)
```sql
invoices
├── id (UUID, primary key)
├── enterprise_id (UUID, foreign key → enterprises.id)
├── invoice_number (string, unique) - "INV-2025-001"
├── billing_period_start (date)
├── billing_period_end (date)
├── total_conversations (integer)
├── subtotal (decimal)
├── tax (decimal)
├── total (decimal)
├── currency (string)
├── status (enum) - 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled'
├── due_date (date)
├── paid_at (timestamp, nullable)
├── created_at (timestamp)
└── updated_at (timestamp)
```

---

## Role-Based Access Control (RBAC) V2

### Role Hierarchy

| Role | Level | Access Scope | Typical User |
|------|-------|--------------|--------------|
| **enterprise_admin** | Enterprise | All data across entire enterprise | IT Admin, System Admin |
| **regional_director** | Region | All data in assigned region(s) | VP of Sales, Regional VP |
| **area_manager** | State/City | All data in assigned state(s)/city(ies) | State Manager |
| **district_manager** | District | All data in assigned district(s) | District Manager |
| **store_manager** | Store | All data in assigned store(s) | Store Manager |
| **field_sales** | Personal | Only own conversations | Sales Rep |
| **retail_staff** | Store | Own conversations + store data (read-only) | Retail Associate |
| **viewer** | Variable | Read-only access to assigned scope | Analyst, Auditor |

### Multi-Assignment Access Rules

**Example**: User is assigned to:
- Primary: `store_id=101` as Store Manager
- Secondary: `store_id=102` as Acting Store Manager
- Secondary: `district_id=10` as District Manager

**Access**:
- Can CREATE conversations at stores 101, 102, or any store in district 10
- Can VIEW all conversations in district 10
- Can MANAGE users in stores 101, 102

### RLS Policies (Updated)

```sql
-- Enterprise isolation (applies to ALL tables)
CREATE POLICY enterprise_isolation ON conversations
  FOR ALL
  USING (enterprise_id = current_user_enterprise_id());

-- Multi-assignment access for conversations
CREATE POLICY user_multi_assignment_access ON conversations
  FOR SELECT
  USING (
    enterprise_id = current_user_enterprise_id()
    AND (
      -- Own conversations
      user_id = current_user_id()
      OR
      -- Assigned to this store
      store_id IN (SELECT assignment_id FROM user_assignments 
                   WHERE user_id = current_user_id() 
                   AND assignment_type = 'store')
      OR
      -- Assigned to this district
      district_id IN (SELECT assignment_id FROM user_assignments 
                      WHERE user_id = current_user_id() 
                      AND assignment_type = 'district')
      OR
      -- Assigned to this city
      city_id IN (SELECT assignment_id FROM user_assignments 
                  WHERE user_id = current_user_id() 
                  AND assignment_type = 'city')
      OR
      -- Assigned to this state
      state_id IN (SELECT assignment_id FROM user_assignments 
                   WHERE user_id = current_user_id() 
                   AND assignment_type = 'state')
      OR
      -- Assigned to this region
      region_id IN (SELECT assignment_id FROM user_assignments 
                    WHERE user_id = current_user_id() 
                    AND assignment_type = 'region')
      OR
      -- Enterprise admin sees all
      current_user_role() = 'enterprise_admin'
    )
  );
```

---

## Billing Rollup Examples

### Store Level
```sql
SELECT 
  s.store_code,
  s.name,
  COUNT(br.id) as conversations,
  SUM(br.amount) as total_amount
FROM billing_records br
JOIN stores s ON br.store_id = s.id
WHERE br.enterprise_id = :enterprise_id
  AND br.billing_period_start = '2025-01-01'
GROUP BY s.id, s.store_code, s.name;
```

### District Level
```sql
SELECT 
  d.name as district,
  COUNT(br.id) as conversations,
  SUM(br.amount) as total_amount
FROM billing_records br
JOIN districts d ON br.district_id = d.id
WHERE br.enterprise_id = :enterprise_id
  AND br.billing_period_start = '2025-01-01'
GROUP BY d.id, d.name;
```

### State Level
```sql
SELECT 
  st.name as state,
  COUNT(br.id) as conversations,
  SUM(br.amount) as total_amount
FROM billing_records br
JOIN states st ON br.state_id = st.id
WHERE br.enterprise_id = :enterprise_id
  AND br.billing_period_start = '2025-01-01'
GROUP BY st.id, st.name;
```

### Region Level
```sql
SELECT 
  r.name as region,
  COUNT(br.id) as conversations,
  SUM(br.amount) as total_amount
FROM billing_records br
JOIN regions r ON br.region_id = r.id
WHERE br.enterprise_id = :enterprise_id
  AND br.billing_period_start = '2025-01-01'
GROUP BY r.id, r.name;
```

### Enterprise Level (All Clients)
```sql
SELECT 
  e.name as enterprise,
  COUNT(br.id) as conversations,
  SUM(br.amount) as total_amount
FROM billing_records br
JOIN enterprises e ON br.enterprise_id = e.id
WHERE br.billing_period_start = '2025-01-01'
GROUP BY e.id, e.name
ORDER BY total_amount DESC;
```

---

## Storage Structure (Updated)

```
audio-recordings/
├── {enterprise_id}/
│   ├── {region_id}/
│   │   ├── {state_id}/
│   │   │   ├── {city_id}/
│   │   │   │   ├── {district_id}/
│   │   │   │   │   ├── {store_id}/
│   │   │   │   │   │   ├── {conversation_id}/
│   │   │   │   │   │   │   ├── {message_id}.webm
```

**Benefits**:
- Calculate storage costs per enterprise, region, state, etc.
- Easy to implement data retention by level
- Supports compliance requirements (e.g., "delete all CA data")

---

## User Reassignment Process

### Simple Reassignment (No History)

```sql
-- Update primary store
UPDATE users 
SET primary_store_id = :new_store_id,
    updated_at = NOW()
WHERE id = :user_id;

-- Update assignments
DELETE FROM user_assignments 
WHERE user_id = :user_id AND assignment_type = 'store';

INSERT INTO user_assignments (user_id, assignment_type, assignment_id, is_primary, assigned_at)
VALUES (:user_id, 'store', :new_store_id, true, NOW());
```

**Note**: Old conversations remain associated with old store. New conversations use new store.

---

## Implementation Phases

### Phase 1: Core Multi-Tenant Structure (Week 1)
- [ ] Create enterprises, regions, states, cities, districts, stores tables
- [ ] Update users table with enterprise_id
- [ ] Implement RLS for enterprise isolation
- [ ] Create user_assignments table
- [ ] Build helper functions for access control

### Phase 2: Conversations & Billing (Week 2)
- [ ] Update conversations table with full hierarchy
- [ ] Create billing_records and invoices tables
- [ ] Implement auto-populate trigger for conversation hierarchy
- [ ] Build billing rollup queries
- [ ] Create usage metrics views

### Phase 3: Supabase Storage (Week 3)
- [ ] Set up Supabase storage buckets
- [ ] Implement hierarchical folder structure
- [ ] Create upload API with proper path generation
- [ ] Implement storage policies matching RLS
- [ ] Add audio recording to conversations

### Phase 4: Admin Interface (Week 4)
- [ ] Enterprise management UI (for iK OneWorld admins)
- [ ] Organization setup wizard for new enterprises
- [ ] User management with multi-assignment
- [ ] Billing dashboard and invoice generation
- [ ] Usage analytics by all levels

---

## Security Considerations

1. **Enterprise Isolation**: Every query MUST filter by `enterprise_id`
2. **Assignment Validation**: Server-side validation that user has access to assignment
3. **Billing Integrity**: Immutable billing records once invoiced
4. **Audit Logging**: Track all reassignments, deletions, access changes
5. **Data Export**: Enterprise admins can export their data only
6. **GDPR Compliance**: Support data deletion requests by enterprise

---

## Questions Answered

✅ **Regional granularity**: 6-level hierarchy (Enterprise → Region → State → City → District → Store)
✅ **User reassignment**: Simple update, no history tracking
✅ **Multi-department/store users**: user_assignments junction table
✅ **Per-conversation billing**: billing_records with multi-level rollup
✅ **Enterprise accounts**: enterprises table as top-level tenant
✅ **Research-based**: Modeled after major retail chains

---

## Next Steps

1. **Review & Approve**: Please review this updated structure
2. **Clarify**: Any additional requirements or modifications?
3. **Implement**: Once approved, I'll create migration scripts and implement

Please confirm this structure meets your needs before I proceed with implementation!
