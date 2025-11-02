-- iK OneWorld Enterprise Seed Data
-- This creates a test enterprise with full organizational hierarchy
-- Run this AFTER supabase-schema-v2-enterprise.sql

-- ============================================================================
-- Create Test Enterprise
-- ============================================================================

INSERT INTO enterprises (id, name, slug, industry, subscription_tier, billing_email, billing_status, max_users, settings, is_active)
VALUES (
    '00000000-0000-0000-0000-000000000001'::UUID,
    'Demo Retail Corp',
    'demo-retail',
    'retail',
    'enterprise',
    'billing@demoretail.com',
    'active',
    NULL, -- unlimited users
    '{"features": ["translation", "analytics", "api_access"], "branding": {"primary_color": "#0066CC"}}',
    true
);

-- ============================================================================
-- Create Regions
-- ============================================================================

INSERT INTO regions (id, enterprise_id, name, code, is_active) VALUES
('10000000-0000-0000-0000-000000000001'::UUID, '00000000-0000-0000-0000-000000000001'::UUID, 'West Coast Region', 'WEST', true),
('10000000-0000-0000-0000-000000000002'::UUID, '00000000-0000-0000-0000-000000000001'::UUID, 'Northeast Region', 'NE', true),
('10000000-0000-0000-0000-000000000003'::UUID, '00000000-0000-0000-0000-000000000001'::UUID, 'Southeast Region', 'SE', true);

-- ============================================================================
-- Create States
-- ============================================================================

INSERT INTO states (id, enterprise_id, region_id, name, code, country_code, is_active) VALUES
-- West Coast
('20000000-0000-0000-0000-000000000001'::UUID, '00000000-0000-0000-0000-000000000001'::UUID, '10000000-0000-0000-0000-000000000001'::UUID, 'California', 'CA', 'US', true),
('20000000-0000-0000-0000-000000000002'::UUID, '00000000-0000-0000-0000-000000000001'::UUID, '10000000-0000-0000-0000-000000000001'::UUID, 'Oregon', 'OR', 'US', true),
-- Northeast
('20000000-0000-0000-0000-000000000003'::UUID, '00000000-0000-0000-0000-000000000001'::UUID, '10000000-0000-0000-0000-000000000002'::UUID, 'New York', 'NY', 'US', true),
('20000000-0000-0000-0000-000000000004'::UUID, '00000000-0000-0000-0000-000000000001'::UUID, '10000000-0000-0000-0000-000000000002'::UUID, 'Massachusetts', 'MA', 'US', true),
-- Southeast
('20000000-0000-0000-0000-000000000005'::UUID, '00000000-0000-0000-0000-000000000001'::UUID, '10000000-0000-0000-0000-000000000003'::UUID, 'Florida', 'FL', 'US', true);

-- ============================================================================
-- Create Cities
-- ============================================================================

INSERT INTO cities (id, enterprise_id, state_id, name, timezone, is_active) VALUES
-- California
('30000000-0000-0000-0000-000000000001'::UUID, '00000000-0000-0000-0000-000000000001'::UUID, '20000000-0000-0000-0000-000000000001'::UUID, 'Los Angeles', 'America/Los_Angeles', true),
('30000000-0000-0000-0000-000000000002'::UUID, '00000000-0000-0000-0000-000000000001'::UUID, '20000000-0000-0000-0000-000000000001'::UUID, 'San Francisco', 'America/Los_Angeles', true),
('30000000-0000-0000-0000-000000000003'::UUID, '00000000-0000-0000-0000-000000000001'::UUID, '20000000-0000-0000-0000-000000000001'::UUID, 'San Diego', 'America/Los_Angeles', true),
-- New York
('30000000-0000-0000-0000-000000000004'::UUID, '00000000-0000-0000-0000-000000000001'::UUID, '20000000-0000-0000-0000-000000000003'::UUID, 'New York City', 'America/New_York', true),
-- Florida
('30000000-0000-0000-0000-000000000005'::UUID, '00000000-0000-0000-0000-000000000001'::UUID, '20000000-0000-0000-0000-000000000005'::UUID, 'Miami', 'America/New_York', true);

-- ============================================================================
-- Create Districts
-- ============================================================================

INSERT INTO districts (id, enterprise_id, city_id, name, code, is_active) VALUES
-- Los Angeles
('40000000-0000-0000-0000-000000000001'::UUID, '00000000-0000-0000-0000-000000000001'::UUID, '30000000-0000-0000-0000-000000000001'::UUID, 'Downtown LA', 'LA-DT', true),
('40000000-0000-0000-0000-000000000002'::UUID, '00000000-0000-0000-0000-000000000001'::UUID, '30000000-0000-0000-0000-000000000001'::UUID, 'West LA', 'LA-W', true),
('40000000-0000-0000-0000-000000000003'::UUID, '00000000-0000-0000-0000-000000000001'::UUID, '30000000-0000-0000-0000-000000000001'::UUID, 'South LA', 'LA-S', true),
-- San Francisco
('40000000-0000-0000-0000-000000000004'::UUID, '00000000-0000-0000-0000-000000000001'::UUID, '30000000-0000-0000-0000-000000000002'::UUID, 'Downtown SF', 'SF-DT', true),
-- NYC
('40000000-0000-0000-0000-000000000005'::UUID, '00000000-0000-0000-0000-000000000001'::UUID, '30000000-0000-0000-0000-000000000004'::UUID, 'Manhattan', 'NYC-MAN', true),
('40000000-0000-0000-0000-000000000006'::UUID, '00000000-0000-0000-0000-000000000001'::UUID, '30000000-0000-0000-0000-000000000004'::UUID, 'Brooklyn', 'NYC-BK', true);

-- ============================================================================
-- Create Stores
-- ============================================================================

INSERT INTO stores (id, enterprise_id, district_id, name, store_code, type, address, phone, timezone, is_active, opened_at) VALUES
-- Downtown LA
('50000000-0000-0000-0000-000000000001'::UUID, '00000000-0000-0000-0000-000000000001'::UUID, '40000000-0000-0000-0000-000000000001'::UUID, 
 'Main Street Store', 'LA-001', 'retail_store', 
 '{"street": "123 Main St", "city": "Los Angeles", "state": "CA", "zip": "90012", "lat": 34.0522, "lng": -118.2437}',
 '213-555-0001', 'America/Los_Angeles', true, '2020-01-15'),
 
('50000000-0000-0000-0000-000000000002'::UUID, '00000000-0000-0000-0000-000000000001'::UUID, '40000000-0000-0000-0000-000000000001'::UUID,
 'Grand Avenue Store', 'LA-002', 'retail_store',
 '{"street": "456 Grand Ave", "city": "Los Angeles", "state": "CA", "zip": "90013"}',
 '213-555-0002', 'America/Los_Angeles', true, '2020-03-20'),

-- West LA
('50000000-0000-0000-0000-000000000003'::UUID, '00000000-0000-0000-0000-000000000001'::UUID, '40000000-0000-0000-0000-000000000002'::UUID,
 'Santa Monica Store', 'LA-003', 'retail_store',
 '{"street": "789 Wilshire Blvd", "city": "Santa Monica", "state": "CA", "zip": "90401"}',
 '310-555-0003', 'America/Los_Angeles', true, '2021-06-10'),

-- Manhattan
('50000000-0000-0000-0000-000000000004'::UUID, '00000000-0000-0000-0000-000000000001'::UUID, '40000000-0000-0000-0000-000000000005'::UUID,
 'Times Square Store', 'NYC-001', 'retail_store',
 '{"street": "1 Times Square", "city": "New York", "state": "NY", "zip": "10036"}',
 '212-555-0001', 'America/New_York', true, '2019-11-01'),

-- Brooklyn
('50000000-0000-0000-0000-000000000005'::UUID, '00000000-0000-0000-0000-000000000001'::UUID, '40000000-0000-0000-0000-000000000006'::UUID,
 'Williamsburg Store', 'NYC-002', 'retail_store',
 '{"street": "100 Bedford Ave", "city": "Brooklyn", "state": "NY", "zip": "11249"}',
 '718-555-0002', 'America/New_York', true, '2022-02-14');

-- ============================================================================
-- Create Departments
-- ============================================================================

INSERT INTO departments (id, enterprise_id, name, type, is_active) VALUES
('60000000-0000-0000-0000-000000000001'::UUID, '00000000-0000-0000-0000-000000000001'::UUID, 'Field Sales', 'field_sales', true),
('60000000-0000-0000-0000-000000000002'::UUID, '00000000-0000-0000-0000-000000000001'::UUID, 'Retail Operations', 'retail', true),
('60000000-0000-0000-0000-000000000003'::UUID, '00000000-0000-0000-0000-000000000001'::UUID, 'Customer Support', 'support', true);

-- ============================================================================
-- Create Test Users
-- ============================================================================

-- Note: These users need to match your auth system
-- Adjust openId values to match actual authenticated users

INSERT INTO users (id, "openId", name, email, role, enterprise_id, enterprise_role, primary_department_id, primary_store_id, employee_id, phone, is_active) VALUES
-- Enterprise Admin
(1, 'admin-001', 'Admin User', 'admin@demoretail.com', 'admin', '00000000-0000-0000-0000-000000000001'::UUID, 'enterprise_admin', NULL, NULL, 'EMP-001', '555-0001', true),

-- Regional Director (West Coast)
(2, 'director-001', 'Sarah Johnson', 'sarah.johnson@demoretail.com', 'admin', '00000000-0000-0000-0000-000000000001'::UUID, 'regional_director', '60000000-0000-0000-0000-000000000002'::UUID, NULL, 'EMP-002', '555-0002', true),

-- District Manager (Downtown LA)
(3, 'manager-001', 'Mike Chen', 'mike.chen@demoretail.com', 'user', '00000000-0000-0000-0000-000000000001'::UUID, 'district_manager', '60000000-0000-0000-0000-000000000002'::UUID, NULL, 'EMP-003', '555-0003', true),

-- Store Manager (Main Street Store)
(4, 'store-mgr-001', 'Emily Rodriguez', 'emily.rodriguez@demoretail.com', 'user', '00000000-0000-0000-0000-000000000001'::UUID, 'store_manager', '60000000-0000-0000-0000-000000000002'::UUID, '50000000-0000-0000-0000-000000000001'::UUID, 'EMP-004', '555-0004', true),

-- Retail Staff (Main Street Store)
(5, 'staff-001', 'James Wilson', 'james.wilson@demoretail.com', 'user', '00000000-0000-0000-0000-000000000001'::UUID, 'retail_staff', '60000000-0000-0000-0000-000000000002'::UUID, '50000000-0000-0000-0000-000000000001'::UUID, 'EMP-005', '555-0005', true),

-- Field Sales Rep
(6, 'sales-001', 'Lisa Martinez', 'lisa.martinez@demoretail.com', 'user', '00000000-0000-0000-0000-000000000001'::UUID, 'field_sales', '60000000-0000-0000-0000-000000000001'::UUID, NULL, 'EMP-006', '555-0006', true);

-- ============================================================================
-- Create User Assignments (Multi-role support)
-- ============================================================================

-- Regional Director assigned to West Coast Region
INSERT INTO user_assignments (user_id, assignment_type, assignment_id, role_in_assignment, is_primary) VALUES
(2, 'region', '10000000-0000-0000-0000-000000000001'::UUID, 'Regional Director', true);

-- District Manager assigned to Downtown LA district
INSERT INTO user_assignments (user_id, assignment_type, assignment_id, role_in_assignment, is_primary) VALUES
(3, 'district', '40000000-0000-0000-0000-000000000001'::UUID, 'District Manager', true);

-- Store Manager assigned to Main Street Store (primary) and Grand Avenue Store (secondary)
INSERT INTO user_assignments (user_id, assignment_type, assignment_id, role_in_assignment, is_primary) VALUES
(4, 'store', '50000000-0000-0000-0000-000000000001'::UUID, 'Store Manager', true),
(4, 'store', '50000000-0000-0000-0000-000000000002'::UUID, 'Acting Store Manager', false);

-- Retail Staff assigned to Main Street Store
INSERT INTO user_assignments (user_id, assignment_type, assignment_id, role_in_assignment, is_primary) VALUES
(5, 'store', '50000000-0000-0000-0000-000000000001'::UUID, 'Sales Associate', true);

-- Field Sales Rep assigned to California state
INSERT INTO user_assignments (user_id, assignment_type, assignment_id, role_in_assignment, is_primary) VALUES
(6, 'state', '20000000-0000-0000-0000-000000000001'::UUID, 'Territory Sales Representative', true);

-- ============================================================================
-- Update manager references
-- ============================================================================

UPDATE regions SET director_user_id = 2 WHERE code = 'WEST';
UPDATE districts SET manager_user_id = 3 WHERE code = 'LA-DT';
UPDATE stores SET manager_user_id = 4 WHERE store_code IN ('LA-001', 'LA-002');

-- ============================================================================
-- Success message
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '✅ Seed data created successfully!';
    RAISE NOTICE '';
    RAISE NOTICE 'Test Enterprise: Demo Retail Corp (ID: 00000000-0000-0000-0000-000000000001)';
    RAISE NOTICE 'Structure:';
    RAISE NOTICE '  - 3 Regions (West Coast, Northeast, Southeast)';
    RAISE NOTICE '  - 5 States (CA, OR, NY, MA, FL)';
    RAISE NOTICE '  - 5 Cities';
    RAISE NOTICE '  - 6 Districts';
    RAISE NOTICE '  - 5 Stores';
    RAISE NOTICE '  - 3 Departments';
    RAISE NOTICE '  - 6 Test Users';
    RAISE NOTICE '';
    RAISE NOTICE 'Test Users:';
    RAISE NOTICE '  1. Admin User (enterprise_admin)';
    RAISE NOTICE '  2. Sarah Johnson (regional_director - West Coast)';
    RAISE NOTICE '  3. Mike Chen (district_manager - Downtown LA)';
    RAISE NOTICE '  4. Emily Rodriguez (store_manager - 2 stores)';
    RAISE NOTICE '  5. James Wilson (retail_staff - Main Street Store)';
    RAISE NOTICE '  6. Lisa Martinez (field_sales - California)';
END $$;
