# Admin User Management Setup Guide

## Overview

The iK OneWorld application now includes a comprehensive admin-controlled user management system with the following features:

- ✅ **Admin-only user creation** - Only admins can add new employees
- ✅ **Forced password reset** - New users must change their password on first login
- ✅ **Account management** - Admins can disable/enable accounts and reset passwords
- ✅ **Role-based access** - Admin vs Employee roles with different permissions

## Creating Your First Admin Account

Since the application is deployed on Vercel with Supabase Auth, you need to create your first admin account directly in Supabase:

### Step 1: Create User in Supabase

1. Go to your Supabase dashboard: https://supabase.com/dashboard
2. Select your project
3. Navigate to **Authentication** → **Users**
4. Click **"Add User"** button
5. Fill in the form:
   - **Email**: Your admin email (e.g., `admin@ikoneworld.com`)
   - **Password**: Your initial password
   - **Auto Confirm User**: ✅ Check this box (important!)
6. Click **"Create User"**

### Step 2: Set Admin Role in Database

1. In Supabase dashboard, navigate to **SQL Editor**
2. Run this SQL query (replace with your email):

```sql
UPDATE users 
SET role = 'admin' 
WHERE email = 'admin@ikoneworld.com';
```

3. If the user doesn't exist in the `users` table yet, you may need to log in once first, then run the update.

### Step 3: Login and Test

1. Go to your application: https://i-koneworld-in-field.vercel.app/login
2. Login with your admin credentials
3. You should see an **"Admin Panel"** button in the dashboard header
4. Click it to access the user management interface

## Admin Features

### Adding New Employees

1. Go to **Admin Panel** → **User Management**
2. Click **"Add New User"**
3. Fill in the form:
   - **Email**: Employee's work email
   - **Name**: Employee's full name (optional)
   - **Initial Password**: Temporary password
   - **Role**: Choose "Employee" or "Admin"
4. Click **"Create User"**

**Important**: The employee will be required to change this password on their first login.

### Managing Existing Users

The admin panel shows all users with the following information:
- Email address
- Name
- Role (Admin/Employee)
- Status (Active/Disabled)
- Password reset requirement
- Last login date

### Available Actions

**Disable User**
- Prevents the user from logging in
- Use for terminated employees or security concerns
- Can be re-enabled later

**Enable User**
- Re-activates a disabled account
- User can log in again with their existing password

**Reset Password**
- Sets a new temporary password for the user
- User will be forced to change it on next login
- Use when employee forgets password or for security resets

## First-Time Login Flow

When a new employee logs in for the first time:

1. Employee enters email and temporary password at `/login`
2. System detects `must_reset_password` flag
3. Employee is redirected to `/reset-password`
4. Employee must create a new password (minimum 8 characters)
5. After successful reset, employee is redirected to dashboard

## Security Features

- ✅ **No public signup** - Only admins can create accounts
- ✅ **Forced password changes** - All new accounts must reset password
- ✅ **Role-based access control** - Admin panel only accessible to admins
- ✅ **Account disable capability** - Immediate access revocation
- ✅ **Password reset tracking** - System tracks which users need to reset

## User Roles

### Admin
- Access to Admin Panel
- Can add new users
- Can disable/enable accounts
- Can reset passwords
- Can view all employees
- Full access to translation features

### Employee
- Access to translation dashboard
- Can start conversations
- Can view their own conversation history
- Cannot access admin features

## Testing the System

### Test Scenario 1: Create New Employee

1. Login as admin
2. Go to Admin Panel
3. Create a new employee with email `test@example.com` and password `TempPass123`
4. Logout
5. Login as the new employee
6. Verify you're redirected to password reset page
7. Change password
8. Verify you can access the dashboard

### Test Scenario 2: Disable/Enable Account

1. Login as admin
2. Go to Admin Panel
3. Disable the test employee account
4. Logout
5. Try to login as the test employee
6. Verify login fails
7. Login as admin again
8. Enable the test employee account
9. Verify the employee can now login

### Test Scenario 3: Reset Password

1. Login as admin
2. Go to Admin Panel
3. Reset password for test employee to `NewTemp456`
4. Logout
5. Login as test employee with new password
6. Verify forced password reset
7. Change to permanent password

## Troubleshooting

### Issue: Admin button not showing in dashboard
**Solution**: Verify the user's role is set to 'admin' in the database:
```sql
SELECT email, role FROM users WHERE email = 'your@email.com';
```

### Issue: Cannot create users in Admin Panel
**Solution**: Check that you're logged in as an admin and that Supabase service role key is configured in Vercel environment variables.

### Issue: Password reset not working
**Solution**: Verify that `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are correctly set in Vercel.

### Issue: User not found in database after Supabase Auth creation
**Solution**: The user record is created automatically on first login. Have the user login once, then update their role to admin.

## API Endpoints

The system uses the following API endpoints:

- `GET /api/admin/users` - List all users (admin only)
- `POST /api/admin/users` - Create/manage users (admin only)
  - Action: `create` - Add new user
  - Action: `disable` - Disable user account
  - Action: `enable` - Enable user account
  - Action: `resetPassword` - Reset user password

## Database Schema

The system uses Supabase Auth for authentication with the following metadata:

**User Metadata Fields**:
- `must_reset_password` (boolean) - Tracks if user needs to change password
- `name` (string) - User's display name

**Users Table Fields**:
- `id` - Auto-increment primary key
- `openId` - Supabase Auth user ID
- `email` - User email
- `name` - Display name
- `role` - 'admin' or 'user'
- `createdAt` - Account creation timestamp
- `updatedAt` - Last update timestamp
- `lastSignedIn` - Last login timestamp

## Next Steps

1. Create your first admin account following Step 1 & 2 above
2. Login and test the admin panel
3. Create employee accounts for your team
4. Test the complete flow with a test employee account
5. Deploy to production and share login instructions with your team

## Support

For issues or questions, refer to the main project documentation or contact the development team.
