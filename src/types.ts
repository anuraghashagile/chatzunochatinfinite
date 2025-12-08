

export enum ChatMode {
  IDLE = 'IDLE',
  SEARCHING = 'SEARCHING',
  WAITING = 'WAITING',
  CONNECTED = 'CONNECTED',
  DISCONNECTED = 'DISCONNECTED',
  ERROR = 'ERROR'
}

export type SessionType = 'random' | 'direct';

export interface UserProfile {
  username: string;
  age: string;
  gender: string;
  interests: string[];
  location: string;
}

export type MessageType = 'text' | 'image' | 'audio';

export interface Reaction {
  emoji: string;
  sender: 'me' | 'stranger';
}

export interface Message {
  id: string;
  text?: string;
  fileData?: string; // Base64 string for images/audio
  type: MessageType;
  sender: 'me' | 'stranger' | 'system';
  senderName?: string; // Added for Global Chat identification
  timestamp: number;
  isVanish?: boolean;
  reactions?: Reaction[]; // Added for reactions
  isEdited?: boolean; // Added for edit status
}

export interface PeerData {
  type: 'message' | 'typing' | 'recording' | 'disconnect' | 'profile' | 'profile_update' | 'vanish_mode' | 'reaction' | 'edit_message';
  payload?: any;
  dataType?: MessageType;
  messageId?: string; // For targeting specific messages (reactions/edits)
}

// Presence state for the lobby
export interface PresenceState {
  peerId: string;
  status: 'waiting' | 'paired' | 'busy';
  timestamp: number;
  profile?: UserProfile; // Added to show names in Online list
}

export interface RecentPeer {
  id: string;
  peerId: string; // The last known session ID
  profile: UserProfile;
  metAt: number;
}

export interface AppSettings {
  soundEnabled: boolean;
  textSize: 'small' | 'medium' | 'large';
  vanishMode: boolean;
}