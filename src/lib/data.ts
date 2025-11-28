
import type { User, Expense, Contribution } from './types';

// This file now only contains data that is truly static or used for seeding.
// The main data is now fetched from Firestore.

export const predefinedTags = ['grocery', 'sabzi', 'cook', 'fast food', 'dinner', 'room rent', 'electricity'];

// The following data is for seeding purposes only.
export const users: User[] = [
  { id: 'user1', name: 'Aakash', avatarUrl: 'https://raw.githubusercontent.com/skyworld-play/tifresh-app/refs/heads/main/Aakash.jpg', pin: '111111', phoneNumber: '+919999999991' },
  { id: 'user2', name: 'Prakash', avatarUrl: 'https://raw.githubusercontent.com/skyworld-play/tifresh-app/refs/heads/main/Prakash.jpg', pin: '222222', phoneNumber: '+919999999992' },
  { id: 'user3', name: 'Amar', avatarUrl: 'https://raw.githubusercontent.com/skyworld-play/tifresh-app/refs/heads/main/Amar.jpg', pin: '333333', phoneNumber: '+919999999993' },
  { id: 'user4', name: 'Ritik', avatarUrl: 'https://raw.githubusercontent.com/skyworld-play/tifresh-app/refs/heads/main/Ritik.jpg', pin: '444444', phoneNumber: '+919999999994' },
];

export const adminPassword = 'Kash#8826';

export const expenses: Expense[] = [];

export const contributions: Contribution[] = [];

    
