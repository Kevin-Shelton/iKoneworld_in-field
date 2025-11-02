-- iK OneWorld Enterprise Multi-Tenant Schema V2
-- This migration adds enterprise organizational structure
-- Run this AFTER the base schema (supabase-schema.sql)

-- ============================================================================
-- STEP 1: Create new ENUM types
-- ============================================================================

CREATE TYPE enterprise_role AS ENUM (
    'enterprise_admin',
    'regional_director', 
    'area_manager',
    'district_manager',
    'store_manager',
    'field_sales',
    'retail_staff',
    'viewer'
);

CREATE TYPE subscription_tier AS ENUM ('starter', 'professional', 'enterprise');
CREATE TYPE billing_status_type AS ENUM ('active', 'suspended', 'trial', 'cancelled');
CREATE TYPE store_type AS ENUM ('retail_store', 'sales_territory', 'kiosk', 'warehouse');
CREATE TYPE department_type AS ENUM ('field_sales', 'retail', 'support', 'corporate');
CREATE TYPE assignment_type AS ENUM ('region', 'state', 'city', 'district', 'store', 'department');
CREATE TYPE conversation_billing_status AS ENUM ('pending', 'billed', 'free_tier');
CREATE TYPE invoice_status AS ENUM ('draft', 'sent', 'paid', 'overdue', 'cancelled');

-- ============================================================================
-- STEP 2: Create organizational hierarchy tables
-- ============================================================================

-- Enterprises (Top-level tenants - your SaaS customers)
CREATE TABLE enterprises (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    industry VARCHAR(100),
    subscription_tier subscription_tier NOT NULL DEFAULT 'starter',
    billing_email VARCHAR(320),
    billing_status billing_status_type NOT NULL DEFAULT 'trial',
    max_users INTEGER,
    max_conversations_per_month INTEGER,
    settings JSONB DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT true,
    trial_ends_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Regions (Geographic Level 1)
CREATE TABLE regions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    enterprise_id UUID NOT NULL REFERENCES enterprises(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) NOT NULL,
    director_user_id UUID,
    settings JSONB DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(enterprise_id, code)
);

-- States (Geographic Level 2)
CREATE TABLE states (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    enterprise_id UUID NOT NULL REFERENCES enterprises(id) ON DELETE CASCADE,
    region_id UUID NOT NULL REFERENCES regions(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(10) NOT NULL,
    country_code VARCHAR(3) NOT NULL DEFAULT 'US',
    manager_user_id UUID,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(enterprise_id, code, country_code)
);

-- Cities (Geographic Level 3)
CREATE TABLE cities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    enterprise_id UUID NOT NULL REFERENCES enterprises(id) ON DELETE CASCADE,
    state_id UUID NOT NULL REFERENCES states(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    timezone VARCHAR(100) DEFAULT 'America/New_York',
    manager_user_id UUID,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Districts (Geographic Level 4)
CREATE TABLE districts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    enterprise_id UUID NOT NULL REFERENCES enterprises(id) ON DELETE CASCADE,
    city_id UUID NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) NOT NULL,
    manager_user_id UUID,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(enterprise_id, code)
);

-- Stores (Geographic Level 5)
CREATE TABLE stores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    enterprise_id UUID NOT NULL REFERENCES enterprises(id) ON DELETE CASCADE,
    district_id UUID NOT NULL REFERENCES districts(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    store_code VARCHAR(50) NOT NULL,
    type store_type NOT NULL DEFAULT 'retail_store',
    address JSONB,
    phone VARCHAR(50),
    manager_user_id UUID,
    timezone VARCHAR(100) DEFAULT 'America/New_York',
    is_active BOOLEAN NOT NULL DEFAULT true,
    opened_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(enterprise_id, store_code)
);

-- Departments (Functional divisions)
CREATE TABLE departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    enterprise_id UUID NOT NULL REFERENCES enterprises(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    type department_type NOT NULL,
    head_user_id UUID,
    settings JSONB DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- STEP 3: Update users table for enterprise multi-tenant
-- ============================================================================

-- Add new columns to existing users table
ALTER TABLE users 
ADD COLUMN enterprise_id UUID REFERENCES enterprises(id) ON DELETE CASCADE,
ADD COLUMN enterprise_role enterprise_role DEFAULT 'retail_staff',
ADD COLUMN primary_department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
ADD COLUMN primary_store_id UUID REFERENCES stores(id) ON DELETE SET NULL,
ADD COLUMN employee_id VARCHAR(100),
ADD COLUMN phone VARCHAR(50),
ADD COLUMN avatar_url TEXT,
ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true;

-- Create unique constraint for employee_id within enterprise
CREATE UNIQUE INDEX idx_users_enterprise_employee ON users(enterprise_id, employee_id) 
WHERE employee_id IS NOT NULL;

-- ============================================================================
-- STEP 4: User assignments (multi-role support)
-- ============================================================================

CREATE TABLE user_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    assignment_type assignment_type NOT NULL,
    assignment_id UUID NOT NULL,
    role_in_assignment VARCHAR(255),
    is_primary BOOLEAN NOT NULL DEFAULT false,
    assigned_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, assignment_type, assignment_id)
);

CREATE INDEX idx_user_assignments_user ON user_assignments(user_id);
CREATE INDEX idx_user_assignments_type_id ON user_assignments(assignment_type, assignment_id);

-- ============================================================================
-- STEP 5: Update conversations table with full hierarchy
-- ============================================================================

ALTER TABLE conversations
ADD COLUMN enterprise_id UUID REFERENCES enterprises(id) ON DELETE CASCADE,
ADD COLUMN department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
ADD COLUMN store_id UUID REFERENCES stores(id) ON DELETE SET NULL,
ADD COLUMN district_id UUID REFERENCES districts(id) ON DELETE SET NULL,
ADD COLUMN city_id UUID REFERENCES cities(id) ON DELETE SET NULL,
ADD COLUMN state_id UUID REFERENCES states(id) ON DELETE SET NULL,
ADD COLUMN region_id UUID REFERENCES regions(id) ON DELETE SET NULL,
ADD COLUMN user_language VARCHAR(16),
ADD COLUMN guest_language VARCHAR(16),
ADD COLUMN duration_seconds INTEGER DEFAULT 0,
ADD COLUMN message_count INTEGER DEFAULT 0,
ADD COLUMN billing_status conversation_billing_status DEFAULT 'pending',
ADD COLUMN billed_at TIMESTAMP,
ADD COLUMN metadata JSONB DEFAULT '{}';

-- Rename existing columns to match new schema
ALTER TABLE conversations RENAME COLUMN language1 TO user_language_old;
ALTER TABLE conversations RENAME COLUMN language2 TO guest_language_old;

-- Copy data to new columns
UPDATE conversations SET user_language = user_language_old, guest_language = guest_language_old;

-- Drop old columns
ALTER TABLE conversations DROP COLUMN user_language_old;
ALTER TABLE conversations DROP COLUMN guest_language_old;

-- Create indexes for conversations
CREATE INDEX idx_conv_enterprise_date ON conversations(enterprise_id, "createdAt");
CREATE INDEX idx_conv_store_date ON conversations(store_id, "createdAt");
CREATE INDEX idx_conv_billing ON conversations(enterprise_id, billing_status, "createdAt");
CREATE INDEX idx_conv_hierarchy ON conversations(enterprise_id, region_id, state_id, city_id, district_id, store_id);

-- ============================================================================
-- STEP 6: Update conversation_messages table
-- ============================================================================

ALTER TABLE conversation_messages
ADD COLUMN enterprise_id UUID REFERENCES enterprises(id) ON DELETE CASCADE,
ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
ADD COLUMN source_language VARCHAR(16),
ADD COLUMN target_language VARCHAR(16),
ADD COLUMN audio_url TEXT,
ADD COLUMN audio_duration_seconds INTEGER,
ADD COLUMN confidence_score DECIMAL(3,2),
ADD COLUMN metadata JSONB DEFAULT '{}';

-- Rename columns to match new schema
ALTER TABLE conversation_messages RENAME COLUMN "originalText" TO original_text;
ALTER TABLE conversation_messages RENAME COLUMN "translatedText" TO translated_text;

-- ============================================================================
-- STEP 7: Billing tables
-- ============================================================================

CREATE TABLE billing_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    enterprise_id UUID NOT NULL REFERENCES enterprises(id) ON DELETE CASCADE,
    conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    billing_period_start DATE NOT NULL,
    billing_period_end DATE NOT NULL,
    conversation_date DATE NOT NULL,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    store_id UUID REFERENCES stores(id) ON DELETE SET NULL,
    district_id UUID REFERENCES districts(id) ON DELETE SET NULL,
    city_id UUID REFERENCES cities(id) ON DELETE SET NULL,
    state_id UUID REFERENCES states(id) ON DELETE SET NULL,
    region_id UUID REFERENCES regions(id) ON DELETE SET NULL,
    department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
    message_count INTEGER NOT NULL DEFAULT 0,
    duration_seconds INTEGER NOT NULL DEFAULT 0,
    unit_price DECIMAL(10,4) NOT NULL DEFAULT 0.00,
    amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    invoice_id UUID,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_billing_rollup ON billing_records(
    enterprise_id, billing_period_start, region_id, state_id, city_id, district_id, store_id
);
CREATE INDEX idx_billing_conversation ON billing_records(conversation_id);

CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    enterprise_id UUID NOT NULL REFERENCES enterprises(id) ON DELETE CASCADE,
    invoice_number VARCHAR(100) NOT NULL UNIQUE,
    billing_period_start DATE NOT NULL,
    billing_period_end DATE NOT NULL,
    total_conversations INTEGER NOT NULL DEFAULT 0,
    subtotal DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    tax DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    total DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    status invoice_status NOT NULL DEFAULT 'draft',
    due_date DATE,
    paid_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_invoices_enterprise ON invoices(enterprise_id, billing_period_start);
CREATE INDEX idx_invoices_status ON invoices(status, due_date);

-- Add foreign key to billing_records
ALTER TABLE billing_records 
ADD CONSTRAINT fk_billing_invoice 
FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE SET NULL;

-- ============================================================================
-- STEP 8: Audit logs
-- ============================================================================

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    enterprise_id UUID REFERENCES enterprises(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(255) NOT NULL,
    resource_type VARCHAR(100) NOT NULL,
    resource_id UUID,
    changes JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_enterprise_date ON audit_logs(enterprise_id, created_at);
CREATE INDEX idx_audit_user ON audit_logs(user_id, created_at);
CREATE INDEX idx_audit_resource ON audit_logs(resource_type, resource_id);

-- ============================================================================
-- STEP 9: Helper functions
-- ============================================================================

-- Function to get current user's enterprise_id
CREATE OR REPLACE FUNCTION current_user_enterprise_id()
RETURNS UUID AS $$
BEGIN
    RETURN current_setting('app.current_enterprise_id', true)::UUID;
EXCEPTION
    WHEN OTHERS THEN
        RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get current user's role
CREATE OR REPLACE FUNCTION current_user_role()
RETURNS enterprise_role AS $$
BEGIN
    RETURN current_setting('app.current_user_role', true)::enterprise_role;
EXCEPTION
    WHEN OTHERS THEN
        RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to auto-populate conversation hierarchy
CREATE OR REPLACE FUNCTION populate_conversation_hierarchy()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.store_id IS NOT NULL THEN
        SELECT 
            s.district_id,
            d.city_id,
            c.state_id,
            st.region_id
        INTO 
            NEW.district_id,
            NEW.city_id,
            NEW.state_id,
            NEW.region_id
        FROM stores s
        JOIN districts d ON s.district_id = d.id
        JOIN cities c ON d.city_id = c.id
        JOIN states st ON c.state_id = st.id
        WHERE s.id = NEW.store_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_populate_conversation_hierarchy
    BEFORE INSERT OR UPDATE ON conversations
    FOR EACH ROW
    EXECUTE FUNCTION populate_conversation_hierarchy();

-- ============================================================================
-- STEP 10: Row Level Security (RLS) Policies
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE enterprises ENABLE ROW LEVEL SECURITY;
ALTER TABLE regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE states ENABLE ROW LEVEL SECURITY;
ALTER TABLE cities ENABLE ROW LEVEL SECURITY;
ALTER TABLE districts ENABLE ROW LEVEL SECURITY;
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- Enterprise isolation policy (applies to all tables)
CREATE POLICY enterprise_isolation_enterprises ON enterprises
    FOR ALL
    USING (id = current_user_enterprise_id());

CREATE POLICY enterprise_isolation_regions ON regions
    FOR ALL
    USING (enterprise_id = current_user_enterprise_id());

CREATE POLICY enterprise_isolation_states ON states
    FOR ALL
    USING (enterprise_id = current_user_enterprise_id());

CREATE POLICY enterprise_isolation_cities ON cities
    FOR ALL
    USING (enterprise_id = current_user_enterprise_id());

CREATE POLICY enterprise_isolation_districts ON districts
    FOR ALL
    USING (enterprise_id = current_user_enterprise_id());

CREATE POLICY enterprise_isolation_stores ON stores
    FOR ALL
    USING (enterprise_id = current_user_enterprise_id());

CREATE POLICY enterprise_isolation_departments ON departments
    FOR ALL
    USING (enterprise_id = current_user_enterprise_id());

CREATE POLICY enterprise_isolation_users ON users
    FOR ALL
    USING (enterprise_id = current_user_enterprise_id());

CREATE POLICY enterprise_isolation_conversations ON conversations
    FOR ALL
    USING (enterprise_id = current_user_enterprise_id());

CREATE POLICY enterprise_isolation_messages ON conversation_messages
    FOR ALL
    USING (enterprise_id = current_user_enterprise_id());

CREATE POLICY enterprise_isolation_billing ON billing_records
    FOR ALL
    USING (enterprise_id = current_user_enterprise_id());

CREATE POLICY enterprise_isolation_invoices ON invoices
    FOR ALL
    USING (enterprise_id = current_user_enterprise_id());

-- ============================================================================
-- STEP 11: Apply updated_at triggers to new tables
-- ============================================================================

CREATE TRIGGER update_enterprises_updated_at
    BEFORE UPDATE ON enterprises
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_regions_updated_at
    BEFORE UPDATE ON regions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_states_updated_at
    BEFORE UPDATE ON states
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cities_updated_at
    BEFORE UPDATE ON cities
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_districts_updated_at
    BEFORE UPDATE ON districts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_stores_updated_at
    BEFORE UPDATE ON stores
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_departments_updated_at
    BEFORE UPDATE ON departments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_invoices_updated_at
    BEFORE UPDATE ON invoices
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Success message
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '✅ Enterprise multi-tenant schema created successfully!';
    RAISE NOTICE 'Next steps:';
    RAISE NOTICE '1. Run seed data script to create test enterprise';
    RAISE NOTICE '2. Configure application to set app.current_enterprise_id';
    RAISE NOTICE '3. Test RLS policies';
END $$;
