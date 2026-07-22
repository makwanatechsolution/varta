export type PresenceStatus = "online" | "away" | "busy" | "dnd" | "offline";
export type ConversationType = "direct" | "group" | "channel";
export type MessageType = "text" | "image" | "video" | "audio" | "file" | "gif" | "system" | "call_log";
export type CallType = "voice" | "video";
export type CallStatus = "ringing" | "active" | "ended" | "missed" | "declined" | "failed";

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Profile {
  id: string;
  username: string | null;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  phone?: string | null;
  last_seen: string;
  presence: PresenceStatus;
  custom_status: string | null;
  custom_status_expires_at: string | null;
  status_privacy?: "everyone" | "contacts" | "close_friends" | "nobody";
  created_at?: string;
  updated_at?: string;
  [key: string]: any;
}

export interface Conversation {
  id: string;
  type: ConversationType;
  title: string | null;
  description?: string | null;
  avatar_url: string | null;
  created_by?: string | null;
  is_archived?: boolean;
  last_message_at: string | null;
  created_at?: string;
  updated_at?: string;
  members?: ConversationMember[];
  last_message?: Message | null;
  [key: string]: any;
}

export interface ConversationMember {
  id: string;
  conversation_id: string;
  user_id: string;
  role: string;
  joined_at?: string;
  last_read_at?: string | null;
  muted_until?: string | null;
  profile?: Profile;
  [key: string]: any;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string | null;
  type: MessageType;
  content: string | null;
  media_url: string | null;
  gif_url: string | null;
  reply_to_id: string | null;
  is_edited: boolean;
  is_deleted: boolean;
  is_starred?: boolean;
  is_pinned?: boolean;
  forwarded_from_id?: string | null;
  created_at: string;
  updated_at?: string;
  sender?: Profile;
  reactions?: MessageReaction[];
  reply_to?: Message | null;
  [key: string]: any;
}

export interface MessageReaction {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
  profile?: Profile;
  [key: string]: any;
}

export interface Call {
  id: string;
  conversation_id: string | null;
  initiator_id: string;
  type: CallType;
  status: CallStatus;
  started_at: string | null;
  answered_at?: string | null;
  ended_at: string | null;
  duration_seconds: number | null;
  quality_score?: number | null;
  created_at?: string;
  initiator?: Profile;
  conversation?: Conversation;
  [key: string]: any;
}

export interface CallParticipant {
  id: string;
  call_id: string;
  user_id: string;
  joined_at: string | null;
  left_at: string | null;
  is_muted: boolean;
  is_video_off: boolean;
  profile?: Profile;
  [key: string]: any;
}

export interface CallSignal {
  id: string;
  call_id: string;
  from_user_id: string;
  to_user_id: string | null;
  signal_type: "offer" | "answer" | "ice-candidate" | "hangup";
  payload: Json;
  created_at: string;
  [key: string]: any;
}

export interface Meeting {
  id: string;
  conversation_id?: string | null;
  host_id: string;
  title: string;
  description: string | null;
  scheduled_at: string;
  duration_minutes?: number;
  join_link: string;
  status: "scheduled" | "live" | "ended" | "cancelled";
  waiting_room_enabled: boolean;
  auto_admit?: boolean;
  recording_url?: string | null;
  recording_consent_given?: boolean;
  call_id?: string | null;
  created_at?: string;
  updated_at?: string;
  host?: Profile;
  [key: string]: any;
}

export interface MeetingParticipant {
  id: string;
  meeting_id: string;
  user_id: string;
  rsvp: "pending" | "accepted" | "declined";
  admitted_at: string | null;
  raised_hand_at: string | null;
  profile?: Profile;
  [key: string]: any;
}

export interface StatusStory {
  id: string;
  user_id: string;
  media_type: "photo" | "video" | "text";
  media_url: string | null;
  text_content: string | null;
  background_color: string;
  visibility?: "everyone" | "contacts" | "close_friends" | "nobody";
  expires_at: string;
  is_deleted?: boolean;
  created_at: string;
  profile?: Profile;
  viewed?: boolean;
  view_count?: number;
  [key: string]: any;
}

export interface StatusView {
  status_id: string;
  viewer_id: string;
  viewed_at: string;
  reaction_emoji: string | null;
  viewer?: Profile;
  [key: string]: any;
}

export interface PushToken {
  id: string;
  user_id: string;
  token: string;
  platform: "web" | "android" | "ios" | null;
  created_at: string;
  updated_at: string;
  [key: string]: any;
}

export interface Invitation {
  id: string;
  inviter_id: string;
  email: string;
  invite_code: string;
  custom_message?: string | null;
  status: "pending" | "accepted" | "expired" | "revoked";
  created_at: string;
  accepted_at?: string | null;
  inviter?: Profile;
  [key: string]: any;
}

export interface Post {
  id: string;
  author_id: string;
  content: string | null;
  media_url: string | null;
  media_type: "image" | "video" | null;
  created_at: string;
  updated_at?: string;
  author?: Profile;
  likes_count?: number;
  comments_count?: number;
  has_liked?: boolean;
  [key: string]: any;
}

export interface PostLike {
  post_id: string;
  user_id: string;
  created_at: string;
  [key: string]: any;
}

export interface PostComment {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  user?: Profile;
  [key: string]: any;
}

export interface GifResult {
  id: string;
  url: string;
  preview: string;
  width: number;
  height: number;
  provider: "tenor" | "giphy";
}

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Partial<Profile> & Record<string, any>;
        Update: Partial<Profile> & Record<string, any>;
        Relationships: [];
      };
      contacts: {
        Row: {
          id: string;
          user_id: string;
          contact_id: string;
          nickname: string | null;
          is_close_friend: boolean;
          created_at: string;
          [key: string]: any;
        };
        Insert: Record<string, any>;
        Update: Record<string, any>;
        Relationships: [];
      };
      conversations: {
        Row: Conversation;
        Insert: Partial<Conversation> & Record<string, any>;
        Update: Partial<Conversation> & Record<string, any>;
        Relationships: [];
      };
      conversation_members: {
        Row: ConversationMember;
        Insert: Partial<ConversationMember> & Record<string, any>;
        Update: Partial<ConversationMember> & Record<string, any>;
        Relationships: [];
      };
      messages: {
        Row: Message;
        Insert: Partial<Message> & Record<string, any>;
        Update: Partial<Message> & Record<string, any>;
        Relationships: [];
      };
      message_reactions: {
        Row: MessageReaction;
        Insert: Partial<MessageReaction> & Record<string, any>;
        Update: Partial<MessageReaction> & Record<string, any>;
        Relationships: [];
      };
      message_read_receipts: {
        Row: {
          message_id: string;
          user_id: string;
          read_at: string;
          [key: string]: any;
        };
        Insert: Record<string, any>;
        Update: Record<string, any>;
        Relationships: [];
      };
      calls: {
        Row: Call;
        Insert: Partial<Call> & Record<string, any>;
        Update: Partial<Call> & Record<string, any>;
        Relationships: [];
      };
      call_participants: {
        Row: CallParticipant;
        Insert: Partial<CallParticipant> & Record<string, any>;
        Update: Partial<CallParticipant> & Record<string, any>;
        Relationships: [];
      };
      call_signals: {
        Row: CallSignal;
        Insert: Partial<CallSignal> & Record<string, any>;
        Update: Partial<CallSignal> & Record<string, any>;
        Relationships: [];
      };
      meetings: {
        Row: Meeting;
        Insert: Partial<Meeting> & Record<string, any>;
        Update: Partial<Meeting> & Record<string, any>;
        Relationships: [];
      };
      meeting_participants: {
        Row: MeetingParticipant;
        Insert: Partial<MeetingParticipant> & Record<string, any>;
        Update: Partial<MeetingParticipant> & Record<string, any>;
        Relationships: [];
      };
      statuses: {
        Row: StatusStory;
        Insert: Partial<StatusStory> & Record<string, any>;
        Update: Partial<StatusStory> & Record<string, any>;
        Relationships: [];
      };
      status_views: {
        Row: StatusView;
        Insert: Partial<StatusView> & Record<string, any>;
        Update: Partial<StatusView> & Record<string, any>;
        Relationships: [];
      };
      push_tokens: {
        Row: PushToken;
        Insert: Partial<PushToken> & Record<string, any>;
        Update: Partial<PushToken> & Record<string, any>;
        Relationships: [];
      };
      gif_favorites: {
        Row: {
          user_id: string;
          gif_url: string;
          provider: "tenor" | "giphy" | null;
          used_count: number;
          last_used_at: string;
          [key: string]: any;
        };
        Insert: Record<string, any>;
        Update: Record<string, any>;
        Relationships: [];
      };
      invitations: {
        Row: Invitation;
        Insert: Partial<Invitation> & Record<string, any>;
        Update: Partial<Invitation> & Record<string, any>;
        Relationships: [];
      };
      posts: {
        Row: Post;
        Insert: Partial<Post> & Record<string, any>;
        Update: Partial<Post> & Record<string, any>;
        Relationships: [];
      };
      post_likes: {
        Row: PostLike;
        Insert: Partial<PostLike> & Record<string, any>;
        Update: Partial<PostLike> & Record<string, any>;
        Relationships: [];
      };
      post_comments: {
        Row: PostComment;
        Insert: Partial<PostComment> & Record<string, any>;
        Update: Partial<PostComment> & Record<string, any>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      presence_status: PresenceStatus;
      conversation_type: ConversationType;
      message_type: MessageType;
      call_type: CallType;
      call_status: CallStatus;
      meeting_status: "scheduled" | "live" | "ended" | "cancelled";
      status_media_type: "photo" | "video" | "text";
      privacy_level: "everyone" | "contacts" | "close_friends" | "nobody";
    };
    CompositeTypes: Record<string, never>;
  };
}
