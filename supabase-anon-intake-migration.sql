-- Allow anonymous patients to submit intake requests via the public front-desk form.
-- Only INSERT is granted — patients cannot read, update, or delete any records.
-- Staff (authenticated) retain full access.

-- appointment_requests: anonymous intake submissions
GRANT INSERT ON public.appointment_requests TO anon;

CREATE POLICY "anon_insert_intake"
  ON public.appointment_requests
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- questionnaire_sessions: anonymous questionnaire completions
GRANT INSERT ON public.questionnaire_sessions TO anon;

CREATE POLICY "anon_insert_questionnaire_session"
  ON public.questionnaire_sessions
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- questionnaire_responses: anonymous answers
GRANT INSERT ON public.questionnaire_responses TO anon;

CREATE POLICY "anon_insert_questionnaire_response"
  ON public.questionnaire_responses
  FOR INSERT
  TO anon
  WITH CHECK (true);
