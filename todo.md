# iK OneWorld - Project TODO

## Phase 1: Project Setup ✅
- [x] Initialize Next.js project with TypeScript
- [x] Set up Vercel deployment
- [x] Configure Supabase PostgreSQL database
- [x] Define database schema (7 tables: users, languages, stt_languages, tts_voices, ttt_languages, conversations, conversation_messages)
- [x] Create and run database migrations
- [x] Populate database with language data (124 languages, 579 TTS voices, 139 translation languages)

## Phase 2: Environment Configuration ✅
- [x] Set up Vercel environment variables
- [x] Configure DATABASE_URL with Supabase connection pooling
- [x] Configure NEXT_PUBLIC_SUPABASE_URL
- [x] Configure NEXT_PUBLIC_SUPABASE_ANON_KEY
- [x] Configure VERBUM_API_KEY

## Phase 3: API Layer ✅
- [x] Create translation API proxy route (/api/translate)
- [x] Create text-to-speech API proxy route (/api/synthesize)
- [x] Create language data API endpoints
  - [x] /api/languages - Get all languages
  - [x] /api/languages/favorites - Get favorite languages
  - [x] /api/languages/voices - Get TTS voices
- [x] Implement database query helpers
- [x] Test database connectivity

## Phase 4: Language Selection Interface ✅
- [x] Create Language Selection page component
- [x] Build Favorite Languages section with 12 popular languages
- [x] Build All Languages section with search functionality
- [x] Implement language data loading from API
- [x] Create Language Confirmation Modal with TTS sample playback
- [x] Implement persistent language selection (localStorage)
- [x] Style responsive layout for mobile/tablet/desktop
- [x] Deploy to production and verify functionality

## Phase 5: Real-Time Audio Capture (TODO)
- [ ] Implement microphone access and permissions
- [ ] Create audio recording component
- [ ] Set up WebSocket connection for real-time streaming
- [ ] Integrate Verbum AI speech-to-text API
- [ ] Handle audio chunking and buffering
- [ ] Implement voice activity detection
- [ ] Add audio visualization

## Phase 6: Speech Pairing and Translation Logic (TODO)
- [ ] Create conversation pairing system
- [ ] Implement bidirectional translation flow
- [ ] Build translation state management
- [ ] Handle concurrent speech detection
- [ ] Implement turn-taking logic
- [ ] Add confidence scoring

## Phase 7: Text-to-Speech Integration (TODO)
- [ ] Integrate Verbum AI TTS API
- [ ] Implement audio playback queue
- [ ] Add voice selection based on language
- [ ] Handle audio streaming and buffering
- [ ] Implement playback controls

## Phase 8: Real-Time Translation UI (TODO)
- [ ] Create translation conversation page
- [ ] Build message display component
- [ ] Implement real-time message updates
- [ ] Add speaker identification
- [ ] Create conversation controls (start/stop/pause)
- [ ] Add visual feedback for active speaker
- [ ] Implement message history scrolling

## Phase 9: Data Persistence (TODO)
- [ ] Implement conversation creation
- [ ] Save messages to database
- [ ] Create conversation history page
- [ ] Implement conversation replay
- [ ] Add export functionality
- [ ] Create user profile management

## Phase 10: Testing and Deployment (TODO)
- [ ] Test end-to-end translation flow
- [ ] Test on multiple devices
- [ ] Optimize performance
- [ ] Add error handling and recovery
- [ ] Create user documentation
- [ ] Final production deployment


## Current Session: Building Conversation Features
- [x] Create conversation page with audio recording UI
- [x] Implement MediaRecorder API for audio capture
- [x] Create STT API route for speech recognition
- [x] Build real-time translation display
- [x] Add conversation controls (start/stop speaking)
- [ ] Implement message persistence to database
- [ ] Test end-to-end flow

## Bug Fix
- [x] Update language selection to support selecting TWO languages (user + guest)
- [x] Fix localStorage keys to match what translate page expects

## Current Bug
- [x] Fix speech recognition API error - investigate Verbum AI STT endpoint
- [x] Update STT implementation to use Web Speech API (browser built-in)
- [x] Implement working translation flow with browser APIs

## New Feature: Supabase Storage Integration
- [ ] Set up Supabase storage bucket for audio recordings
- [ ] Update database schema to include audio_url field in messages table
- [ ] Create API endpoint to upload audio to Supabase storage
- [ ] Update translate page to record and upload audio files
- [ ] Save conversation messages with transcripts to database
- [ ] Add conversation history view

## Updated Requirements from User
- [ ] Add regional granularity: Region → State → City → Store
- [ ] Support user reassignment (no history tracking needed)
- [ ] Allow users to operate across multiple departments/stores (regional managers, executives)
- [ ] Implement per-conversation billing model with multi-level rollup
- [ ] Support enterprise-level accounts (multi-tenant SaaS)
- [ ] Research complete: Enterprise retail typically uses 5-6 level hierarchy

## Implementation: Enterprise Multi-Tenant Structure
- [x] Create database migration for organizational hierarchy tables
- [x] Update users table with enterprise_id and role enums
- [x] Create user_assignments table for multi-role support
- [x] Update conversations table with full hierarchy fields
- [x] Create billing_records and invoices tables
- [x] Implement database triggers for auto-populating hierarchy
- [x] Create RLS policies for enterprise isolation
- [x] Build helper functions for access control
- [x] Create seed data script for testing
- [x] Create comprehensive setup documentation
- [ ] Build admin UI for enterprise management
- [ ] Test multi-tenant isolation and access control
- [ ] Update Next.js app to use new schema

## Supabase Integration
- [x] Create Supabase client configuration files
- [x] Create .env.local with environment variables
- [x] Create database utility functions for conversations and messages
- [ ] Update conversation page to save to Supabase
- [ ] Implement audio upload to Supabase storage
- [ ] Build admin UI for enterprise management
- [ ] Build admin UI for store/user management
- [ ] Test end-to-end flow with database persistence

## Employee Authentication & Customer Tracking
- [x] Set up Supabase Auth configuration
- [x] Create employee login page
- [ ] Create employee signup/registration page
- [ ] Build employee profile management page
- [ ] Implement smart customer ID generation (CUST-YYYYMMDD-XXXXX)
- [ ] Create customers table for anonymous tracking
- [ ] Update conversations table to link employee + customer
- [ ] Update conversation page for employee-customer flow
- [ ] Build employee dashboard with conversation history
- [ ] Add protected routes for authenticated employees only

## Admin User Management System
- [x] Add user_metadata fields to track password reset status
- [x] Create admin panel page (/admin/users)
- [x] Build user management UI (list, add, disable, reset password)
- [x] Implement role-based access control (admin vs employee)
- [x] Create API endpoint for admin to add new users
- [x] Create API endpoint for admin to disable/enable users
- [x] Create API endpoint for admin to reset user passwords
- [x] Implement forced password change on first login
- [x] Create password reset page for first-time users
- [x] Add admin navigation and role checking
- [ ] Test complete admin and user flows

## Authentication Routing Fix
- [x] Update home page (/) to redirect unauthenticated users to /login
- [x] Redirect authenticated users from / to /dashboard
- [ ] Test complete authentication flow

## Bug: Conversation Creation Failing
- [x] Investigate conversation creation API error
- [x] Fix authentication/user data passing to conversation endpoint
- [x] Added fetchUserDatabaseId function to get user's database ID from Supabase Auth ID
- [x] Updated initializeConversation to accept and use actual user ID
- [x] Updated saveMessageToDatabase to use actual user ID
- [ ] Test conversation creation flow

## Bug: User Not Found in Database Table
- [x] Create API endpoint to sync authenticated user to database (/api/users/sync)
- [x] Update translate page to sync user before fetching database ID
- [x] Update dashboard to sync user on load
- [x] Handle user creation when they don't exist in users table
- [ ] Test complete flow with new user

## Profile Management Feature
- [x] Add default_language field to users table schema
- [x] Create migration script for adding default_language column
- [x] Create /api/profile endpoint for getting user profile
- [x] Create /api/profile endpoint for updating user profile
- [x] Build profile management page (/profile)
- [x] Display organizational hierarchy information (placeholder for future)
- [x] Add language selector with all available languages
- [x] Update select-language page to check for default language
- [x] Add profile link to dashboard navigation
- [ ] Run migration to add default_language column to database
- [ ] Test profile update and default language functionality

## Bug: Profile Page Errors
- [x] Fix Select component empty value error (remove empty string SelectItem)
- [x] Update profile API GET to handle missing default_language column gracefully
- [x] Update profile API PUT to handle missing default_language column gracefully
- [ ] Test profile page after fixes

## Bug: Profile Data Not Displaying
- [x] Fix user sync to capture and save email from Supabase Auth
- [x] Update user sync to update existing users with email and lastSignedIn
- [x] Fix languages API to return data in expected format { languages: [] }
- [x] createdAt timestamp already set correctly in user sync
- [ ] Test profile page displays all data correctly after re-login

## Language Selector Improvements
- [x] Replace Select with custom searchable dropdown
- [x] Add search/filter input to language selector with Search icon
- [x] Display full language and country names: "Language (NativeName)"
- [x] Show selected language with ability to clear selection
- [x] Filter languages by name, native name, or code
- [x] Add visual indicator (checkmark) for selected language
- [ ] Test search functionality in deployed app
