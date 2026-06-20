// Matrix Client-Server API Client
// All requests go through Next.js API proxy routes to the Matrix homeserver

import { ApiClientError } from "./api-errors";

export interface MatrixLoginResponse {
  access_token: string;
  user_id: string;
  home_server: string;
  device_id: string;
}

export interface MatrixEvent {
  event_id: string;
  sender: string;
  content: {
    msgtype?: string;
    body?: string;
    format?: string;
    formatted_body?: string;
    membership?: string;
    displayname?: string;
    avatar_url?: string;
    name?: string;
    topic?: string;
  } & Record<string, unknown>;
  type: string;
  origin_server_ts: number;
  state_key?: string;
  unsigned?: Record<string, unknown>;
}

export interface MatrixJoinedRoom {
  timeline: {
    events: MatrixEvent[];
    limited: boolean;
    prev_batch: string;
  };
  state: {
    events: MatrixEvent[];
  };
  summary: {
    heroes?: string[];
    joined_member_count?: number;
    invited_member_count?: number;
  };
  unread_notifications?: {
    highlight_count: number;
    notification_count: number;
  };
}

export interface MatrixSyncResponse {
  next_batch: string;
  rooms?: {
    join?: Record<string, MatrixJoinedRoom>;
    invite?: Record<string, unknown>;
    leave?: Record<string, unknown>;
  };
  presence?: { events: MatrixEvent[] };
  account_data?: { events: MatrixEvent[] };
}

export interface MatrixMessagesResponse {
  chunk: MatrixEvent[];
  start: string;
  end: string;
}

export interface MatrixMembersResponse {
  chunk: MatrixEvent[];
}

export interface MatrixJoinedRoomsResponse {
  joined_rooms: string[];
}

export interface MatrixRoomStateEvent {
  event_id?: string;
  type: string;
  state_key: string;
  content: Record<string, unknown>;
  sender?: string;
}

// ============ API Methods ============

export const matrixApi = {
  // Login
  login: async (homeserver: string, username: string, password: string): Promise<MatrixLoginResponse> => {
    const res = await fetch('/api/matrix/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ homeserver, username, password }),
    });
    if (!res.ok) {
      throw await ApiClientError.fromResponse(res, 'matrix', '/login');
    }
    return res.json();
  },

  // Sync
  sync: async (homeserver: string, accessToken: string, since?: string, timeout = 30000): Promise<MatrixSyncResponse> => {
    const params = new URLSearchParams({
      homeserver,
      accessToken,
      timeout: String(timeout),
    });
    if (since) params.set('since', since);
    const res = await fetch(`/api/matrix/sync?${params}`);
    if (!res.ok) {
      throw await ApiClientError.fromResponse(res, 'matrix', '/sync');
    }
    return res.json();
  },

  // Joined rooms
  getJoinedRooms: async (homeserver: string, accessToken: string): Promise<MatrixJoinedRoomsResponse> => {
    const params = new URLSearchParams({ homeserver, accessToken });
    const res = await fetch(`/api/matrix/joined-rooms?${params}`);
    if (!res.ok) {
      throw await ApiClientError.fromResponse(res, 'matrix', '/joined-rooms');
    }
    return res.json();
  },

  // Room messages
  getRoomMessages: async (
    homeserver: string,
    accessToken: string,
    roomId: string,
    options: { dir?: string; limit?: number; from?: string } = {}
  ): Promise<MatrixMessagesResponse> => {
    const params = new URLSearchParams({
      homeserver,
      accessToken,
      dir: options.dir || 'b',
      limit: String(options.limit || 50),
    });
    if (options.from) params.set('from', options.from);
    const encodedRoomId = encodeURIComponent(roomId);
    const res = await fetch(`/api/matrix/rooms/${encodedRoomId}/messages?${params}`);
    if (!res.ok) {
      throw await ApiClientError.fromResponse(res, 'matrix', `/rooms/${encodedRoomId}/messages`);
    }
    return res.json();
  },

  // Room members
  getRoomMembers: async (homeserver: string, accessToken: string, roomId: string): Promise<MatrixMembersResponse> => {
    const params = new URLSearchParams({ homeserver, accessToken });
    const encodedRoomId = encodeURIComponent(roomId);
    const res = await fetch(`/api/matrix/rooms/${encodedRoomId}/members?${params}`);
    if (!res.ok) {
      throw await ApiClientError.fromResponse(res, 'matrix', `/rooms/${encodedRoomId}/members`);
    }
    return res.json();
  },

  // Room state
  getRoomState: async (homeserver: string, accessToken: string, roomId: string): Promise<MatrixRoomStateEvent[]> => {
    const params = new URLSearchParams({ homeserver, accessToken });
    const encodedRoomId = encodeURIComponent(roomId);
    const res = await fetch(`/api/matrix/rooms/${encodedRoomId}/state?${params}`);
    if (!res.ok) {
      throw await ApiClientError.fromResponse(res, 'matrix', `/rooms/${encodedRoomId}/state`);
    }
    return res.json();
  },

  // Send message
  sendMessage: async (
    homeserver: string,
    accessToken: string,
    roomId: string,
    body: string,
    options: { msgtype?: string; format?: string; formattedBody?: string } = {}
  ): Promise<{ event_id: string }> => {
    const encodedRoomId = encodeURIComponent(roomId);
    const res = await fetch(`/api/matrix/rooms/${encodedRoomId}/send?homeserver=${encodeURIComponent(homeserver)}&accessToken=${encodeURIComponent(accessToken)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        msgtype: options.msgtype || 'm.text',
        body,
        format: options.format,
        formattedBody: options.formattedBody,
      }),
    });
    if (!res.ok) {
      throw await ApiClientError.fromResponse(res, 'matrix', `/rooms/${encodedRoomId}/send`);
    }
    return res.json();
  },
};
