-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public._deprecated_room_participant (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL,
  user_id uuid NOT NULL,
  joined_at timestamp with time zone DEFAULT now(),
  left_at timestamp with time zone,
  is_host boolean DEFAULT false,
  current_focus_score integer DEFAULT 0,
  CONSTRAINT _deprecated_room_participant_pkey PRIMARY KEY (id),
  CONSTRAINT room_participant_room_id_fkey FOREIGN KEY (room_id) REFERENCES public._deprecated_study_room(room_id),
  CONSTRAINT room_participant_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public._deprecated_study_room (
  room_id uuid NOT NULL DEFAULT gen_random_uuid(),
  room_name character varying NOT NULL,
  description text,
  max_participants integer DEFAULT 10,
  is_private boolean DEFAULT false,
  created_by uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  is_active boolean DEFAULT true,
  CONSTRAINT _deprecated_study_room_pkey PRIMARY KEY (room_id),
  CONSTRAINT study_room_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id)
);
CREATE TABLE public.backup_room_participant (
  id uuid,
  room_id uuid,
  user_id uuid,
  joined_at timestamp with time zone,
  left_at timestamp with time zone,
  is_host boolean,
  current_focus_score integer
);
CREATE TABLE public.backup_study_room (
  room_id uuid,
  room_name character varying,
  description text,
  max_participants integer,
  is_private boolean,
  created_by uuid,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  is_active boolean
);
CREATE TABLE public.challenge (
  challenge_id uuid NOT NULL DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL,
  mode text NOT NULL CHECK (mode = ANY (ARRAY['pomodoro'::text, 'custom'::text])),
  config jsonb NOT NULL,
  state text NOT NULL DEFAULT 'pending'::text CHECK (state = ANY (ARRAY['pending'::text, 'active'::text, 'ended'::text])),
  start_at timestamp with time zone NOT NULL,
  end_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid,
  CONSTRAINT challenge_pkey PRIMARY KEY (challenge_id),
  CONSTRAINT challenge_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.study_rooms(room_id),
  CONSTRAINT challenge_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id)
);
CREATE TABLE public.challenge_history (
  history_id uuid NOT NULL DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL,
  challenge_id uuid NOT NULL,
  duration integer NOT NULL,
  scores jsonb NOT NULL,
  winner_id uuid NOT NULL,
  mode text NOT NULL CHECK (mode = ANY (ARRAY['pomodoro'::text, 'custom'::text])),
  config jsonb NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT challenge_history_pkey PRIMARY KEY (history_id),
  CONSTRAINT challenge_history_winner_id_fkey FOREIGN KEY (winner_id) REFERENCES auth.users(id),
  CONSTRAINT challenge_history_challenge_id_fkey FOREIGN KEY (challenge_id) REFERENCES public.challenge(challenge_id),
  CONSTRAINT challenge_history_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.study_rooms(room_id),
  CONSTRAINT challenge_history_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id)
);
CREATE TABLE public.challenge_invitation (
  invitation_id uuid NOT NULL DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL,
  challenge_id uuid NOT NULL,
  proposed_by uuid NOT NULL,
  mode text NOT NULL CHECK (mode = ANY (ARRAY['pomodoro'::text, 'custom'::text])),
  config jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'accepted'::text, 'rejected'::text, 'expired'::text])),
  responses jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  expires_at timestamp with time zone DEFAULT (now() + '00:05:00'::interval),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT challenge_invitation_pkey PRIMARY KEY (invitation_id),
  CONSTRAINT challenge_invitation_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.study_rooms(room_id),
  CONSTRAINT challenge_invitation_proposed_by_fkey FOREIGN KEY (proposed_by) REFERENCES auth.users(id),
  CONSTRAINT challenge_invitation_challenge_id_fkey FOREIGN KEY (challenge_id) REFERENCES public.challenge(challenge_id)
);
CREATE TABLE public.challenge_invitation_response (
  response_id uuid NOT NULL DEFAULT gen_random_uuid(),
  invitation_id uuid NOT NULL,
  user_id uuid NOT NULL,
  response text NOT NULL CHECK (response = ANY (ARRAY['accepted'::text, 'rejected'::text])),
  timestamp timestamp with time zone DEFAULT now(),
  CONSTRAINT challenge_invitation_response_pkey PRIMARY KEY (response_id),
  CONSTRAINT challenge_invitation_response_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT challenge_invitation_response_invitation_id_fkey FOREIGN KEY (invitation_id) REFERENCES public.challenge_invitation(invitation_id)
);
CREATE TABLE public.challenge_participant (
  challenge_id uuid NOT NULL,
  user_id uuid NOT NULL,
  joined_at timestamp with time zone NOT NULL DEFAULT now(),
  left_at timestamp with time zone,
  final_score numeric DEFAULT 0,
  CONSTRAINT challenge_participant_pkey PRIMARY KEY (challenge_id, user_id),
  CONSTRAINT challenge_participant_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT challenge_participant_challenge_id_fkey FOREIGN KEY (challenge_id) REFERENCES public.challenge(challenge_id)
);
CREATE TABLE public.challenge_tick (
  challenge_id uuid NOT NULL,
  ts timestamp with time zone NOT NULL DEFAULT now(),
  scores jsonb NOT NULL,
  rankings jsonb NOT NULL,
  CONSTRAINT challenge_tick_pkey PRIMARY KEY (challenge_id, ts),
  CONSTRAINT challenge_tick_challenge_id_fkey FOREIGN KEY (challenge_id) REFERENCES public.challenge(challenge_id)
);
CREATE TABLE public.competition_participants (
  participant_id uuid NOT NULL DEFAULT gen_random_uuid(),
  competition_id uuid NOT NULL,
  user_id uuid NOT NULL,
  total_focus_score numeric NOT NULL DEFAULT 0,
  average_focus_score numeric NOT NULL DEFAULT 0,
  focus_time_minutes integer NOT NULL DEFAULT 0,
  rank integer,
  joined_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT competition_participants_pkey PRIMARY KEY (participant_id),
  CONSTRAINT competition_participants_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT competition_participants_competition_id_fkey FOREIGN KEY (competition_id) REFERENCES public.focus_competitions(competition_id)
);
CREATE TABLE public.competition_results (
  result_id uuid NOT NULL DEFAULT gen_random_uuid(),
  competition_id uuid NOT NULL,
  user_id uuid NOT NULL,
  rank integer NOT NULL,
  total_score numeric NOT NULL,
  average_score numeric NOT NULL,
  focus_time integer NOT NULL,
  reward_coins integer DEFAULT 0,
  reward_badges ARRAY,
  completed_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT competition_results_pkey PRIMARY KEY (result_id),
  CONSTRAINT competition_results_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT competition_results_competition_id_fkey FOREIGN KEY (competition_id) REFERENCES public.focus_competitions(competition_id)
);
CREATE TABLE public.encouragement_messages (
  message_id uuid NOT NULL DEFAULT gen_random_uuid(),
  from_user_id uuid NOT NULL,
  to_user_id uuid NOT NULL,
  room_id uuid,
  message_type character varying NOT NULL DEFAULT 'text'::character varying CHECK (message_type::text = ANY (ARRAY['text'::character varying, 'emoji'::character varying, 'sticker'::character varying, 'ai_generated'::character varying]::text[])),
  content text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT encouragement_messages_pkey PRIMARY KEY (message_id),
  CONSTRAINT encouragement_messages_from_user_id_fkey FOREIGN KEY (from_user_id) REFERENCES auth.users(id),
  CONSTRAINT encouragement_messages_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.study_rooms(room_id),
  CONSTRAINT encouragement_messages_to_user_id_fkey FOREIGN KEY (to_user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.focus_competitions (
  competition_id uuid NOT NULL DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL,
  name character varying NOT NULL,
  duration_minutes integer NOT NULL CHECK (duration_minutes > 0),
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  ended_at timestamp with time zone,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  host_id uuid,
  CONSTRAINT focus_competitions_pkey PRIMARY KEY (competition_id),
  CONSTRAINT focus_competitions_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.study_rooms(room_id),
  CONSTRAINT focus_competitions_host_id_fkey FOREIGN KEY (host_id) REFERENCES auth.users(id)
);
CREATE TABLE public.focus_event (
  event_id uuid NOT NULL DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL,
  ts timestamp with time zone NOT NULL,
  event_type USER-DEFINED NOT NULL,
  payload jsonb,
  created_at timestamp with time zone DEFAULT now(),
  event_type_new USER-DEFINED,
  CONSTRAINT focus_event_pkey PRIMARY KEY (event_id),
  CONSTRAINT focus_event_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.focus_session(session_id)
);
CREATE TABLE public.focus_sample (
  session_id uuid NOT NULL,
  ts timestamp with time zone NOT NULL,
  raw_score smallint,
  score_conf numeric,
  score smallint CHECK (score IS NULL OR score >= 0 AND score <= 100),
  p_eye real,
  pose_dev real,
  topic_tag text,
  rms_db real,
  created_at timestamp with time zone DEFAULT now(),
  ear_value numeric,
  eye_status character varying,
  head_pose_pitch numeric,
  head_pose_yaw numeric,
  head_pose_roll numeric,
  CONSTRAINT focus_sample_pkey PRIMARY KEY (session_id, ts),
  CONSTRAINT focus_sample_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.focus_session(session_id)
);
CREATE TABLE public.focus_session (
  session_id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  started_at timestamp with time zone NOT NULL,
  ended_at timestamp with time zone,
  goal_min integer,
  context_tag text,
  session_type text DEFAULT 'study'::text,
  focus_score numeric CHECK (focus_score >= 0::numeric AND focus_score <= 100::numeric),
  distractions integer DEFAULT 0,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  room_id uuid,
  CONSTRAINT focus_session_pkey PRIMARY KEY (session_id),
  CONSTRAINT focus_session_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT focus_session_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.study_rooms(room_id)
);
CREATE TABLE public.friend_activity_status (
  status_id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'offline'::text CHECK (status = ANY (ARRAY['online'::text, 'offline'::text, 'focusing'::text, 'break'::text, 'away'::text])),
  current_focus_score integer DEFAULT 0,
  last_activity timestamp with time zone DEFAULT now(),
  current_session_id uuid,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT friend_activity_status_pkey PRIMARY KEY (status_id),
  CONSTRAINT friend_activity_status_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT friend_activity_status_current_session_id_fkey FOREIGN KEY (current_session_id) REFERENCES public.focus_session(session_id)
);
CREATE TABLE public.friend_comparison_stats (
  stat_id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  friend_id uuid NOT NULL,
  period_type text NOT NULL CHECK (period_type = ANY (ARRAY['daily'::text, 'weekly'::text, 'monthly'::text])),
  period_start date NOT NULL,
  period_end date NOT NULL,
  total_focus_time integer DEFAULT 0,
  average_focus_score numeric DEFAULT 0,
  total_sessions integer DEFAULT 0,
  rank_position integer,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT friend_comparison_stats_pkey PRIMARY KEY (stat_id),
  CONSTRAINT friend_comparison_stats_friend_id_fkey FOREIGN KEY (friend_id) REFERENCES auth.users(id),
  CONSTRAINT friend_comparison_stats_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.friend_encouragement_messages (
  message_id uuid NOT NULL DEFAULT gen_random_uuid(),
  from_user_id uuid NOT NULL,
  to_user_id uuid NOT NULL,
  message_type text NOT NULL DEFAULT 'text'::text CHECK (message_type = ANY (ARRAY['text'::text, 'emoji'::text, 'sticker'::text, 'ai_generated'::text])),
  content text NOT NULL,
  is_read boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT friend_encouragement_messages_pkey PRIMARY KEY (message_id),
  CONSTRAINT friend_encouragement_messages_from_user_id_fkey FOREIGN KEY (from_user_id) REFERENCES auth.users(id),
  CONSTRAINT friend_encouragement_messages_to_user_id_fkey FOREIGN KEY (to_user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.friend_requests (
  request_id uuid NOT NULL DEFAULT gen_random_uuid(),
  from_user_id uuid NOT NULL,
  to_user_id uuid NOT NULL,
  message text,
  status character varying NOT NULL DEFAULT 'pending'::character varying CHECK (status::text = ANY (ARRAY['pending'::character varying, 'accepted'::character varying, 'rejected'::character varying]::text[])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT friend_requests_pkey PRIMARY KEY (request_id),
  CONSTRAINT friend_requests_from_user_id_fkey FOREIGN KEY (from_user_id) REFERENCES auth.users(id),
  CONSTRAINT friend_requests_to_user_id_fkey FOREIGN KEY (to_user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.group_challenge (
  challenge_id uuid NOT NULL DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL,
  title character varying NOT NULL,
  description text,
  type character varying NOT NULL CHECK (type::text = ANY (ARRAY['focus_time'::character varying, 'study_sessions'::character varying, 'streak_days'::character varying, 'focus_score'::character varying, 'custom'::character varying]::text[])),
  target_value integer NOT NULL,
  current_value integer NOT NULL DEFAULT 0,
  unit character varying NOT NULL,
  start_date timestamp with time zone NOT NULL DEFAULT now(),
  end_date timestamp with time zone NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  is_completed boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  challenge_type text DEFAULT 'team'::text CHECK (challenge_type = ANY (ARRAY['personal'::text, 'team'::text])),
  CONSTRAINT group_challenge_pkey PRIMARY KEY (challenge_id),
  CONSTRAINT group_challenge_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id),
  CONSTRAINT group_challenge_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.study_rooms(room_id)
);
CREATE TABLE public.group_challenge_participant (
  participant_id uuid NOT NULL DEFAULT gen_random_uuid(),
  challenge_id uuid NOT NULL,
  user_id uuid NOT NULL,
  contribution integer NOT NULL DEFAULT 0,
  last_contribution_at timestamp with time zone NOT NULL DEFAULT now(),
  joined_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT group_challenge_participant_pkey PRIMARY KEY (participant_id),
  CONSTRAINT group_challenge_participant_challenge_id_fkey FOREIGN KEY (challenge_id) REFERENCES public.group_challenge(challenge_id),
  CONSTRAINT group_challenge_participant_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.group_challenge_participants (
  participant_id uuid NOT NULL DEFAULT gen_random_uuid(),
  challenge_id uuid NOT NULL,
  user_id uuid NOT NULL,
  current_progress numeric NOT NULL DEFAULT 0,
  joined_at timestamp with time zone NOT NULL DEFAULT now(),
  completed_at timestamp with time zone,
  CONSTRAINT group_challenge_participants_pkey PRIMARY KEY (participant_id),
  CONSTRAINT group_challenge_participants_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT group_challenge_participants_challenge_id_fkey FOREIGN KEY (challenge_id) REFERENCES public.group_challenges(challenge_id)
);
CREATE TABLE public.group_challenges (
  challenge_id uuid NOT NULL DEFAULT gen_random_uuid(),
  name character varying NOT NULL,
  description text,
  goal_type character varying NOT NULL CHECK (goal_type::text = ANY (ARRAY['total_hours'::character varying, 'total_sessions'::character varying, 'average_focus_score'::character varying]::text[])),
  goal_value numeric NOT NULL CHECK (goal_value > 0::numeric),
  duration_days integer NOT NULL CHECK (duration_days > 0),
  reward_coins integer NOT NULL DEFAULT 0,
  reward_badges ARRAY,
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  ends_at timestamp with time zone NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT group_challenges_pkey PRIMARY KEY (challenge_id),
  CONSTRAINT group_challenges_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id)
);
CREATE TABLE public.habit_records (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  habit_id uuid NOT NULL,
  date date NOT NULL,
  completed_count integer DEFAULT 1,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT habit_records_pkey PRIMARY KEY (id),
  CONSTRAINT habit_records_habit_id_fkey FOREIGN KEY (habit_id) REFERENCES public.habits(id)
);
CREATE TABLE public.habits (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  category text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT habits_pkey PRIMARY KEY (id),
  CONSTRAINT habits_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.migration_log (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  version character varying NOT NULL UNIQUE CHECK (version::text ~ '^[0-9]{3}[a-z]?$'::text),
  description text NOT NULL,
  executed_at timestamp with time zone NOT NULL DEFAULT now(),
  execution_time_ms integer,
  success boolean NOT NULL DEFAULT true,
  error_message text,
  rollback_available boolean NOT NULL DEFAULT false,
  rollback_script text,
  CONSTRAINT migration_log_pkey PRIMARY KEY (id)
);
CREATE TABLE public.ml_features (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL,
  ts timestamp with time zone NOT NULL,
  head_pose_pitch numeric,
  head_pose_yaw numeric,
  head_pose_roll numeric,
  eye_status character varying,
  ear_value numeric CHECK (ear_value >= 0::numeric),
  frame_number integer DEFAULT 0 CHECK (frame_number >= 0),
  focus_status character varying,
  focus_confidence numeric CHECK (focus_confidence >= 0::numeric AND focus_confidence <= 1::numeric),
  focus_score numeric CHECK (focus_score >= 0::numeric AND focus_score <= 100::numeric),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT ml_features_pkey PRIMARY KEY (id),
  CONSTRAINT ml_features_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.focus_session(session_id)
);
CREATE TABLE public.note (
  note_id uuid NOT NULL DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL,
  ts_ref timestamp with time zone NOT NULL,
  content text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT note_pkey PRIMARY KEY (note_id),
  CONSTRAINT note_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.focus_session(session_id)
);
CREATE TABLE public.pairing_code (
  code text NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + '00:03:00'::interval),
  used boolean NOT NULL DEFAULT false,
  CONSTRAINT pairing_code_pkey PRIMARY KEY (code),
  CONSTRAINT pairing_code_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.personal_challenge (
  id integer NOT NULL DEFAULT nextval('personal_challenge_id_seq'::regclass),
  user_id uuid,
  title text NOT NULL,
  description text,
  type text NOT NULL,
  target_value numeric NOT NULL,
  current_value numeric DEFAULT 0,
  unit text NOT NULL,
  start_date timestamp with time zone NOT NULL,
  end_date timestamp with time zone NOT NULL,
  is_active boolean DEFAULT true,
  is_completed boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  min_session_duration integer DEFAULT 30,
  CONSTRAINT personal_challenge_pkey PRIMARY KEY (id),
  CONSTRAINT personal_challenge_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.profiles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  display_name character varying NOT NULL,
  handle character varying NOT NULL UNIQUE,
  avatar_url text,
  bio text,
  school character varying,
  major character varying,
  status character varying NOT NULL DEFAULT 'online'::character varying CHECK (status::text = ANY (ARRAY['online'::character varying, 'offline'::character varying, 'in_session'::character varying, 'do_not_disturb'::character varying]::text[])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.reward_claim (
  claim_id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  date date NOT NULL,
  exp integer DEFAULT 0,
  sticker_id text,
  claimed_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT reward_claim_pkey PRIMARY KEY (claim_id),
  CONSTRAINT reward_claim_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.room_participants (
  participant_id uuid NOT NULL DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL,
  user_id uuid NOT NULL,
  joined_at timestamp with time zone NOT NULL DEFAULT now(),
  left_at timestamp with time zone,
  current_focus_score numeric CHECK (current_focus_score >= 0::numeric AND current_focus_score <= 100::numeric),
  is_host boolean NOT NULL DEFAULT false,
  is_connected boolean NOT NULL DEFAULT true,
  last_activity timestamp with time zone NOT NULL DEFAULT now(),
  is_video_enabled boolean DEFAULT false,
  is_audio_enabled boolean DEFAULT false,
  camera_updated_at timestamp with time zone DEFAULT now(),
  is_present boolean DEFAULT false,
  presence_updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT room_participants_pkey PRIMARY KEY (participant_id),
  CONSTRAINT room_participants_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT room_participants_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.study_rooms(room_id)
);
CREATE TABLE public.routine_toggle (
  user_id uuid NOT NULL,
  routine_id text NOT NULL,
  enabled boolean DEFAULT false,
  updated_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT routine_toggle_pkey PRIMARY KEY (user_id, routine_id),
  CONSTRAINT routine_toggle_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.sensor_sample (
  session_id uuid NOT NULL,
  ts timestamp with time zone NOT NULL,
  hr_mean real,
  hr_std real,
  acc_rms real,
  acc_std real,
  CONSTRAINT sensor_sample_pkey PRIMARY KEY (session_id, ts),
  CONSTRAINT sensor_sample_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.focus_session(session_id)
);
CREATE TABLE public.social_stats (
  user_id uuid NOT NULL,
  total_friends integer NOT NULL DEFAULT 0,
  total_rooms_joined integer NOT NULL DEFAULT 0,
  total_competitions_won integer NOT NULL DEFAULT 0,
  total_challenges_completed integer NOT NULL DEFAULT 0,
  total_encouragements_sent integer NOT NULL DEFAULT 0,
  total_encouragements_received integer NOT NULL DEFAULT 0,
  current_streak integer NOT NULL DEFAULT 0,
  longest_streak integer NOT NULL DEFAULT 0,
  total_coins integer NOT NULL DEFAULT 0,
  total_badges integer NOT NULL DEFAULT 0,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT social_stats_pkey PRIMARY KEY (user_id),
  CONSTRAINT social_stats_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.study_rooms (
  room_id uuid NOT NULL DEFAULT gen_random_uuid(),
  host_id uuid NOT NULL,
  name character varying NOT NULL,
  description text,
  max_participants integer NOT NULL DEFAULT 10 CHECK (max_participants >= 2 AND max_participants <= 50),
  current_participants integer NOT NULL DEFAULT 1 CHECK (current_participants >= 0),
  is_active boolean NOT NULL DEFAULT true,
  session_type character varying NOT NULL DEFAULT 'study'::character varying CHECK (session_type::text = ANY (ARRAY['study'::character varying, 'work'::character varying, 'reading'::character varying, 'other'::character varying]::text[])),
  goal_minutes integer CHECK (goal_minutes > 0),
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  ended_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  linked_challenge_id uuid,
  CONSTRAINT study_rooms_pkey PRIMARY KEY (room_id),
  CONSTRAINT study_rooms_host_id_fkey FOREIGN KEY (host_id) REFERENCES auth.users(id),
  CONSTRAINT study_rooms_linked_challenge_id_fkey FOREIGN KEY (linked_challenge_id) REFERENCES public.group_challenges(challenge_id)
);
CREATE TABLE public.user_achievements (
  achievement_id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  achievement_type character varying NOT NULL,
  title character varying NOT NULL,
  description text,
  icon_url text,
  earned_at timestamp with time zone NOT NULL DEFAULT now(),
  progress numeric CHECK (progress >= 0::numeric AND progress <= 100::numeric),
  max_progress numeric CHECK (max_progress > 0::numeric),
  CONSTRAINT user_achievements_pkey PRIMARY KEY (achievement_id),
  CONSTRAINT user_achievements_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.user_friends (
  friendship_id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  friend_id uuid NOT NULL,
  status character varying NOT NULL DEFAULT 'pending'::character varying CHECK (status::text = ANY (ARRAY['pending'::character varying, 'active'::character varying, 'blocked'::character varying]::text[])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT user_friends_pkey PRIMARY KEY (friendship_id),
  CONSTRAINT user_friends_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT user_friends_friend_id_fkey FOREIGN KEY (friend_id) REFERENCES auth.users(id)
);
CREATE TABLE public.watch_codes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  code text NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  is_used boolean DEFAULT false,
  used_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT watch_codes_pkey PRIMARY KEY (id),
  CONSTRAINT watch_codes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.watch_connections (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  device_id text NOT NULL,
  device_type text DEFAULT 'watch'::text,
  last_seen_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true,
  CONSTRAINT watch_connections_pkey PRIMARY KEY (id),
  CONSTRAINT watch_connections_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.weekly_summary (
  user_id uuid NOT NULL,
  iso_year integer NOT NULL,
  iso_week integer NOT NULL,
  avg_score numeric DEFAULT 0,
  quiet_ratio numeric DEFAULT 0,
  habit_idx numeric DEFAULT 0,
  total_focus_min integer DEFAULT 0,
  total_sessions integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT weekly_summary_pkey PRIMARY KEY (user_id, iso_year, iso_week),
  CONSTRAINT weekly_summary_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);