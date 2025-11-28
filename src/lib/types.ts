
export type User = {
  id: string;
  name: string;
  avatarUrl: string;
  pin: string;
  phoneNumber?: string;
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

    
