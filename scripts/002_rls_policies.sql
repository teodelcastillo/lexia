-- =============================================================================
-- Row Level Security (RLS) Policies
-- =============================================================================
-- Implements contextual permission system where:
-- - Admin General: Full access to everything
-- - Case Leader: Full access to assigned cases
-- - Lawyer/Executive: Access to assigned cases and tasks
-- - Client: Read-only access to own case status and shared documents
-- =============================================================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deadlines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_notes ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- HELPER FUNCTIONS FOR PERMISSION CHECKS
-- =============================================================================

-- Check if current user is an admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND role = 'admin_general'
    AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Check if current user is an internal staff member (not a client)
CREATE OR REPLACE FUNCTION is_internal_user()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND role IN ('admin_general', 'case_leader', 'lawyer_executive')
    AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Check if current user has access to a specific case
-- Returns true if user is admin, case leader, or assigned to the case
CREATE OR REPLACE FUNCTION has_case_access(check_case_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- Admins have access to all cases
  IF is_admin() THEN
    RETURN true;
  END IF;
  
  -- Check if user is assigned to this case
  RETURN EXISTS (
    SELECT 1 FROM public.case_assignments
    WHERE case_id = check_case_id
    AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Check if current user is a leader for a specific case
CREATE OR REPLACE FUNCTION is_case_leader(check_case_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- Admins have leader privileges on all cases
  IF is_admin() THEN
    RETURN true;
  END IF;
  
  -- Check if user is assigned as leader to this case
  RETURN EXISTS (
    SELECT 1 FROM public.case_assignments
    WHERE case_id = check_case_id
    AND user_id = auth.uid()
    AND assignment_role = 'leader'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Check if current user is a client with access to a specific case
CREATE OR REPLACE FUNCTION is_client_for_case(check_case_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM public.profiles p
    JOIN public.clients c ON c.portal_user_id = p.id
    JOIN public.cases ca ON ca.client_id = c.id
    WHERE p.id = auth.uid()
    AND p.role = 'client'
    AND ca.id = check_case_id
    AND ca.is_visible_to_client = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- =============================================================================
-- PROFILES TABLE POLICIES
-- =============================================================================

-- Users can view their own profile
CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT
  USING (id = auth.uid());

-- Admins can view all profiles
CREATE POLICY "profiles_select_admin"
  ON public.profiles FOR SELECT
  USING (is_admin());

-- Internal users can view other internal users (for assignments, etc.)
CREATE POLICY "profiles_select_internal"
  ON public.profiles FOR SELECT
  USING (
    is_internal_user() 
    AND role IN ('admin_general', 'case_leader', 'lawyer_executive')
  );

-- Users can update their own profile (limited fields)
CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Admins can update any profile
CREATE POLICY "profiles_update_admin"
  ON public.profiles FOR UPDATE
  USING (is_admin());

-- Admins can insert profiles (for creating new users)
CREATE POLICY "profiles_insert_admin"
  ON public.profiles FOR INSERT
  WITH CHECK (is_admin() OR id = auth.uid());

-- =============================================================================
-- CLIENTS TABLE POLICIES
-- =============================================================================

-- Admins can do everything with clients
CREATE POLICY "clients_admin_all"
  ON public.clients FOR ALL
  USING (is_admin());

-- Internal users can view all clients
CREATE POLICY "clients_select_internal"
  ON public.clients FOR SELECT
  USING (is_internal_user());

-- Case leaders and executives can view clients for their assigned cases
CREATE POLICY "clients_select_assigned"
  ON public.clients FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.cases c
      JOIN public.case_assignments ca ON ca.case_id = c.id
      WHERE c.client_id = clients.id
      AND ca.user_id = auth.uid()
    )
  );

-- Clients can view their own client record
CREATE POLICY "clients_select_own"
  ON public.clients FOR SELECT
  USING (portal_user_id = auth.uid());

-- Internal users can insert and update clients
CREATE POLICY "clients_insert_internal"
  ON public.clients FOR INSERT
  WITH CHECK (is_internal_user());

CREATE POLICY "clients_update_internal"
  ON public.clients FOR UPDATE
  USING (is_internal_user());

-- =============================================================================
-- CASES TABLE POLICIES
-- =============================================================================

-- Admins have full access to all cases
CREATE POLICY "cases_admin_all"
  ON public.cases FOR ALL
  USING (is_admin());

-- Users can view cases they are assigned to
CREATE POLICY "cases_select_assigned"
  ON public.cases FOR SELECT
  USING (has_case_access(id));

-- Clients can view their own cases (if visible)
CREATE POLICY "cases_select_client"
  ON public.cases FOR SELECT
  USING (is_client_for_case(id));

-- Case leaders can update their assigned cases
CREATE POLICY "cases_update_leader"
  ON public.cases FOR UPDATE
  USING (is_case_leader(id));

-- Internal users can create cases
CREATE POLICY "cases_insert_internal"
  ON public.cases FOR INSERT
  WITH CHECK (is_internal_user());

-- =============================================================================
-- CASE_ASSIGNMENTS TABLE POLICIES
-- =============================================================================

-- Admins have full access
CREATE POLICY "case_assignments_admin_all"
  ON public.case_assignments FOR ALL
  USING (is_admin());

-- Case leaders can manage assignments for their cases
CREATE POLICY "case_assignments_leader_all"
  ON public.case_assignments FOR ALL
  USING (is_case_leader(case_id));

-- Users can view their own assignments
CREATE POLICY "case_assignments_select_own"
  ON public.case_assignments FOR SELECT
  USING (user_id = auth.uid());

-- Users with case access can view all assignments for that case
CREATE POLICY "case_assignments_select_case"
  ON public.case_assignments FOR SELECT
  USING (has_case_access(case_id));

-- =============================================================================
-- TASKS TABLE POLICIES
-- =============================================================================

-- Admins have full access
CREATE POLICY "tasks_admin_all"
  ON public.tasks FOR ALL
  USING (is_admin());

-- Users with case access can view tasks
CREATE POLICY "tasks_select_assigned"
  ON public.tasks FOR SELECT
  USING (has_case_access(case_id));

-- Case leaders can manage all tasks in their cases
CREATE POLICY "tasks_leader_all"
  ON public.tasks FOR ALL
  USING (is_case_leader(case_id));

-- Assigned users can update their own tasks
CREATE POLICY "tasks_update_assigned_to"
  ON public.tasks FOR UPDATE
  USING (assigned_to = auth.uid() AND has_case_access(case_id));

-- Users with case access can create tasks
CREATE POLICY "tasks_insert_case_access"
  ON public.tasks FOR INSERT
  WITH CHECK (has_case_access(case_id));

-- =============================================================================
-- DOCUMENTS TABLE POLICIES
-- =============================================================================

-- Admins have full access
CREATE POLICY "documents_admin_all"
  ON public.documents FOR ALL
  USING (is_admin());

-- Users with case access can view documents
CREATE POLICY "documents_select_assigned"
  ON public.documents FOR SELECT
  USING (has_case_access(case_id));

-- Clients can view documents marked as visible to them
CREATE POLICY "documents_select_client"
  ON public.documents FOR SELECT
  USING (
    is_client_for_case(case_id) 
    AND is_visible_to_client = true
  );

-- Case leaders can manage documents in their cases
CREATE POLICY "documents_leader_all"
  ON public.documents FOR ALL
  USING (is_case_leader(case_id));

-- Users with case access can upload documents
CREATE POLICY "documents_insert_case_access"
  ON public.documents FOR INSERT
  WITH CHECK (has_case_access(case_id));

-- Users can update documents they uploaded
CREATE POLICY "documents_update_own"
  ON public.documents FOR UPDATE
  USING (uploaded_by = auth.uid() AND has_case_access(case_id));

-- =============================================================================
-- DEADLINES TABLE POLICIES
-- =============================================================================

-- Admins have full access
CREATE POLICY "deadlines_admin_all"
  ON public.deadlines FOR ALL
  USING (is_admin());

-- Users with case access can view deadlines
CREATE POLICY "deadlines_select_assigned"
  ON public.deadlines FOR SELECT
  USING (has_case_access(case_id));

-- Case leaders can manage deadlines
CREATE POLICY "deadlines_leader_all"
  ON public.deadlines FOR ALL
  USING (is_case_leader(case_id));

-- Users with case access can create deadlines
CREATE POLICY "deadlines_insert_case_access"
  ON public.deadlines FOR INSERT
  WITH CHECK (has_case_access(case_id));

-- =============================================================================
-- ACTIVITY_LOG TABLE POLICIES
-- =============================================================================

-- Admins can view all activity
CREATE POLICY "activity_log_admin_select"
  ON public.activity_log FOR SELECT
  USING (is_admin());

-- Users can view activity for cases they have access to
CREATE POLICY "activity_log_select_case"
  ON public.activity_log FOR SELECT
  USING (case_id IS NOT NULL AND has_case_access(case_id));

-- Users can view their own activity
CREATE POLICY "activity_log_select_own"
  ON public.activity_log FOR SELECT
  USING (user_id = auth.uid());

-- Internal users can insert activity logs
CREATE POLICY "activity_log_insert"
  ON public.activity_log FOR INSERT
  WITH CHECK (is_internal_user() OR user_id = auth.uid());

-- =============================================================================
-- CASE_NOTES TABLE POLICIES
-- =============================================================================

-- Admins have full access
CREATE POLICY "case_notes_admin_all"
  ON public.case_notes FOR ALL
  USING (is_admin());

-- Users with case access can view notes
CREATE POLICY "case_notes_select_assigned"
  ON public.case_notes FOR SELECT
  USING (has_case_access(case_id));

-- Clients can view notes marked as visible to them
CREATE POLICY "case_notes_select_client"
  ON public.case_notes FOR SELECT
  USING (
    is_client_for_case(case_id) 
    AND is_visible_to_client = true
  );

-- Case leaders can manage notes
CREATE POLICY "case_notes_leader_all"
  ON public.case_notes FOR ALL
  USING (is_case_leader(case_id));

-- Users with case access can create notes
CREATE POLICY "case_notes_insert_case_access"
  ON public.case_notes FOR INSERT
  WITH CHECK (has_case_access(case_id));

-- Users can update their own notes
CREATE POLICY "case_notes_update_own"
  ON public.case_notes FOR UPDATE
  USING (created_by = auth.uid() AND has_case_access(case_id));
