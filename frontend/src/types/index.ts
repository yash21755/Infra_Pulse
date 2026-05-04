export type IssueStatus = 'open' | 'in_progress' | 'resolved';

export type UserRole = 'student' | 'faculty' | 'authority';
export type UpdateTag = 'work_in_progress' | 'finished';

export type IssueCategory =
  | 'Electrical'
  | 'Sanitation'
  | 'Plumbing'
  | 'HVAC'
  | 'Structural'
  | 'IT / Network'
  | 'Landscaping / Outdoors'
  | 'Elevator / Escalator'
  | 'Safety / Security'
  | 'Furniture / Equipment'
  | 'General';

export interface GeoLocation {
  lat: number;
  lng: number;
  label: string;
}

export interface IssueImage {
  id: string;
  url: string;
  uploadedAt: string;
  type: 'report' | 'proof_of_work';
}

export interface AuthorityUpdate {
  id: string;
  issueId: string;
  author: {
    id: string;
    anonymousHandle: string;
    role: UserRole;
  };
  message: string;
  tag: UpdateTag;
  imageUrl?: string;
  createdAt: string;
}

export interface Issue {
  id: string;
  title: string;
  description: string;
  category: IssueCategory;
  tags: string[];
  status: IssueStatus;
  upvotes: number;
  downvotes: number;
  userVote: 'up' | 'down' | null;
  location: GeoLocation;
  images: IssueImage[];
  reportedAt: string;
  updatedAt: string;
  similarityScore?: number;
  commentCount: number;
  viewCount: number;
}

export interface User {
  id: string;
  anonymousHandle: string;
  role: UserRole;
  reportCount: number;
  resolvedCount: number;
  joinedAt: string;
  notificationsEnabled: boolean;
}