# Organization-Aligned User Roles Design

## Current Organization Structure

Based on your database schema, your organization has a **hierarchical structure**:

```
Enterprise (Top Level - SaaS Customer)
  └── Region (Geographic Level 1)
      └── State (Geographic Level 2)
          └── City (Geographic Level 3)
              └── District (Geographic Level 4)
                  └── Store (Physical Location)
                      └── Department (Functional Unit)
```

## Existing Enterprise Roles

Your `enterprise_role` enum already defines these roles:

1. **enterprise_admin** - Top-level administrator
2. **regional_director** - Manages regions
3. **area_manager** - Manages areas/states
4. **district_manager** - Manages districts
5. **store_manager** - Manages individual stores
6. **field_sales** - Field sales representatives
7. **retail_staff** - Store employees
8. **viewer** - Read-only access

## Proposed User Role Mapping

### Option A: Align with Enterprise Roles (Recommended)

Use the existing `enterprise_role` enum values for the `user_role` enum:

```sql
CREATE TYPE user_role AS ENUM (
    'enterprise_admin',    -- Full system access
    'regional_director',   -- Region-level access
    'area_manager',        -- State/area-level access
    'district_manager',    -- District-level access
    'store_manager',       -- Store-level access
    'field_sales',         -- Field sales access
    'retail_staff',        -- Store employee access
    'viewer'               -- Read-only access
);
```

### Option B: Simplified Role Hierarchy

Create a simpler role structure that maps to organizational levels:

```sql
CREATE TYPE user_role AS ENUM (
    'admin',              -- Enterprise admin (existing)
    'director',           -- Regional/Area directors
    'manager',            -- District/Store managers
    'employee',           -- Field sales and retail staff
    'viewer',             -- Read-only access
    'user'                -- General user (existing, for backward compatibility)
);
```

## Recommended Approach: Option A

**Use the existing `enterprise_role` values** because:

1. ✅ Already defined in your schema
2. ✅ Aligns with organizational hierarchy
3. ✅ Provides granular permission control
4. ✅ Matches your business structure
5. ✅ Users table already has `enterprise_role` column

## Role Permissions Matrix

### Audio Recording Access

| Role | Default Access | Typical Use Case |
|------|---------------|------------------|
| enterprise_admin | ✅ Full | System configuration, all recordings |
| regional_director | ✅ Full | Regional oversight, compliance |
| area_manager | ✅ Full | Area performance monitoring |
| district_manager | ✅ Full | District quality assurance |
| store_manager | ✅ Full | Store operations, training |
| field_sales | ✅ Limited | Own conversations only |
| retail_staff | ✅ Limited | Own conversations only |
| viewer | ❌ None | Reports and analytics only |

### Transcript Access

| Role | Default Access | Typical Use Case |
|------|---------------|------------------|
| enterprise_admin | ✅ Full | All transcripts |
| regional_director | ✅ Full | Regional analysis |
| area_manager | ✅ Full | Area performance |
| district_manager | ✅ Full | District quality |
| store_manager | ✅ Full | Store training |
| field_sales | ✅ Limited | Own transcripts |
| retail_staff | ✅ Limited | Own transcripts |
| viewer | ✅ Limited | Anonymized data only |

### Settings Management

| Role | Can Modify Settings | Scope |
|------|-------------------|-------|
| enterprise_admin | ✅ Yes | Enterprise-wide |
| regional_director | ⚠️ Partial | Region-specific (future) |
| area_manager | ❌ No | View only |
| district_manager | ❌ No | View only |
| store_manager | ❌ No | View only |
| field_sales | ❌ No | No access |
| retail_staff | ❌ No | No access |
| viewer | ❌ No | No access |

## Implementation Strategy

### Phase 1: Add Enterprise Roles to user_role Enum

```sql
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'enterprise_admin';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'regional_director';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'area_manager';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'district_manager';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'store_manager';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'field_sales';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'retail_staff';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'viewer';
```

### Phase 2: Sync Existing Users

If users already have `enterprise_role`, sync it to `role`:

```sql
UPDATE users 
SET role = enterprise_role::text::user_role
WHERE enterprise_role IS NOT NULL;
```

### Phase 3: Update Enterprise Settings Defaults

```sql
UPDATE enterprise_settings
SET 
    audio_access_roles = ARRAY[
        'enterprise_admin',
        'regional_director',
        'area_manager',
        'district_manager',
        'store_manager',
        'field_sales',
        'retail_staff'
    ],
    transcript_access_roles = ARRAY[
        'enterprise_admin',
        'regional_director',
        'area_manager',
        'district_manager',
        'store_manager',
        'field_sales',
        'retail_staff'
    ];
```

### Phase 4: Update Admin UI

Update the admin settings page to show all 8 roles with descriptions:

```typescript
const AVAILABLE_ROLES = [
  { value: 'enterprise_admin', label: 'Enterprise Admin', description: 'Full system access' },
  { value: 'regional_director', label: 'Regional Director', description: 'Regional oversight' },
  { value: 'area_manager', label: 'Area Manager', description: 'Area/state management' },
  { value: 'district_manager', label: 'District Manager', description: 'District operations' },
  { value: 'store_manager', label: 'Store Manager', description: 'Store management' },
  { value: 'field_sales', label: 'Field Sales', description: 'Sales representatives' },
  { value: 'retail_staff', label: 'Retail Staff', description: 'Store employees' },
  { value: 'viewer', label: 'Viewer', description: 'Read-only access' },
];
```

## Role Hierarchy & Inheritance

### Hierarchical Access Model

Higher-level roles inherit permissions from lower levels:

```
enterprise_admin (sees everything)
  └── regional_director (sees region + below)
      └── area_manager (sees area + below)
          └── district_manager (sees district + below)
              └── store_manager (sees store + below)
                  └── field_sales / retail_staff (sees own data)
                      └── viewer (limited view)
```

### Implementation in Code

```typescript
const ROLE_HIERARCHY = {
  enterprise_admin: 8,
  regional_director: 7,
  area_manager: 6,
  district_manager: 5,
  store_manager: 4,
  field_sales: 2,
  retail_staff: 2,
  viewer: 1,
  user: 2, // For backward compatibility
  admin: 8, // For backward compatibility
};

function canAccessConversation(userRole: string, conversationOwnerRole: string): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[conversationOwnerRole];
}
```

## Scope-Based Permissions (Future Enhancement)

### Current: Enterprise-Wide Settings

All settings apply to the entire enterprise.

### Future: Hierarchical Settings

Allow settings at each organizational level:

- **Enterprise Settings** - Apply to everyone
- **Regional Settings** - Override for specific regions
- **Store Settings** - Override for specific stores

Example:
```typescript
interface HierarchicalSettings {
  enterprise_id: string;
  region_id?: string;
  state_id?: string;
  district_id?: string;
  store_id?: string;
  enable_audio_recording: boolean;
  // ... other settings
}
```

## Migration Path

### Step 1: Current State Assessment

Your database has:
- ✅ `enterprise_role` enum with 8 values
- ✅ `user_role` enum with 2 values (user, admin)
- ✅ `users.enterprise_role` column
- ⚠️ `users.role` column (needs population)

### Step 2: Migration Execution

1. Add all `enterprise_role` values to `user_role` enum
2. Sync `enterprise_role` to `role` for existing users
3. Update enterprise settings with new role arrays
4. Update admin UI to show all roles
5. Test permission checks with new roles

### Step 3: Backward Compatibility

Keep 'admin' and 'user' for backward compatibility:
- 'admin' → maps to 'enterprise_admin'
- 'user' → maps to 'retail_staff'

## Benefits of This Approach

1. **Alignment** - Roles match organizational structure
2. **Granularity** - 8 distinct permission levels
3. **Scalability** - Easy to add regional/store-specific settings
4. **Clarity** - Role names reflect actual job functions
5. **Flexibility** - Admins can customize access per role
6. **Reuse** - Leverages existing `enterprise_role` enum

## Example Use Cases

### Use Case 1: Regional Director Access

**Scenario:** Regional director wants to review all conversations in their region.

**Implementation:**
```typescript
// Check if user is regional director
if (user.role === 'regional_director') {
  // Get conversations from their region
  const conversations = await getConversationsByRegion(user.region_id);
}
```

### Use Case 2: Store Manager Restrictions

**Scenario:** Store manager should only see conversations from their store.

**Implementation:**
```typescript
// Filter conversations by store
if (user.role === 'store_manager') {
  const conversations = await getConversationsByStore(user.primary_store_id);
}
```

### Use Case 3: Field Sales Privacy

**Scenario:** Field sales reps should only see their own conversations.

**Implementation:**
```typescript
// Filter to user's own conversations
if (user.role === 'field_sales') {
  const conversations = await getConversationsByUser(user.id);
}
```

## Next Steps

1. ✅ Review this design and confirm it matches your needs
2. ✅ Run the migration to add all roles to the enum
3. ✅ Update enterprise settings with new default roles
4. ✅ Update admin UI to show all 8 roles
5. ✅ Implement role-based filtering (future phase)
6. ✅ Test with users of different roles

## Summary

This design aligns user roles with your organizational hierarchy, providing granular control over audio and transcript access while maintaining flexibility for future enhancements like regional settings and hierarchical permissions.

The 8-role system maps directly to your business structure and provides clear, intuitive permission management for administrators.
