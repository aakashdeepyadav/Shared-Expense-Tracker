
export type User = {
  id: string;
  name: string;
  avatarUrl: string;
  pin: string;
  memberType?: string;
  phoneNumber?: string;
};

export type SetupMemberInput = {
  name: string;
  avatarUrl?: string;
  pin: string;
  phoneNumber?: string;
  memberType?: string;
};

export type FirebaseProjectConfigInput = {
  apiKey?: string;
  authDomain?: string;
  projectId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
  measurementId?: string;
  [key: string]: string | undefined;
};

export type TrackerTheme = "system" | "light" | "dark";

export type AppConfig = {
  initialized: boolean;
  groupId?: string;
  groupName: string;
  groupImageUrl?: string;
  memberTypeLabel?: string;
  adminName?: string;
  adminAvatarUrl?: string;
  themePreference: TrackerTheme;
  modelApiKey?: string;
  firebaseProjectConfig?: FirebaseProjectConfigInput;
  currentPeriodStart?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type TrackerSetupPayload = {
  groupId?: string;
  groupName: string;
  groupImageUrl?: string;
  memberTypeLabel?: string;
  members: SetupMemberInput[];
  adminIndex: number;
  adminPassword: string;
  themePreference: TrackerTheme;
  modelApiKey?: string;
  firebaseProjectConfig?: FirebaseProjectConfigInput;
};

export type MemberSignupInput = {
  name: string;
  pin: string;
  phoneNumber?: string;
  avatarUrl?: string;
  memberType?: string;
};

export type Expense = {
  id: string;
  description: string;
  amount: number;
  payerId: string;
  date: string;
  tags: string[];
  participants: {
    userId: string;
    share: number;
  }[];
};

export type Contribution = {
  id: string;
  contributorId: string;
  amount: number;
  date: string;
};

export type ChatMessage = {
  id: string;
  text: string;
  userId: string;
  userName: string;
  userAvatar: string;
  timestamp: string;
  readBy: string[];
};

export type AuditLogEntry = {
  id: string;
  actorId: string;
  action: string;
  metadata?: Record<string, unknown> | null;
  timestamp: string;
};

export type MonthArchiveSummary = {
  id: string;
  groupId?: string;
  periodLabel: string;
  periodStart: string;
  periodEnd: string;
  expenseCount: number;
  contributionCount: number;
  messageCount: number;
  archivedAt: string;
};

export type MonthArchive = MonthArchiveSummary & {
  expenses: Expense[];
  contributions: Contribution[];
  messages: ChatMessage[];
};

    
