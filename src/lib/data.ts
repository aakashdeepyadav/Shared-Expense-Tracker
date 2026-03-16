
import type { User, Expense, Contribution } from './types';

// This file now only contains data that is truly static or used for seeding.
// The main data is now fetched from Firestore.

export const predefinedTags = ['grocery', 'sabzi', 'cook', 'fast food', 'dinner', 'room rent', 'electricity'];

// The following data is for seeding purposes only.
export const users: User[] = [
  { id: 'user1', name: 'Aakash', avatarUrl: 'https://placehold.co/128x128/png?text=A', pin: '111111', phoneNumber: '+919999999991' },
  { id: 'user2', name: 'Prakash', avatarUrl: 'https://placehold.co/128x128/png?text=P', pin: '222222', phoneNumber: '+919999999992' },
  { id: 'user3', name: 'Amar', avatarUrl: 'https://placehold.co/128x128/png?text=Am', pin: '333333', phoneNumber: '+919999999993' },
  { id: 'user4', name: 'Ritik', avatarUrl: 'https://placehold.co/128x128/png?text=R', pin: '444444', phoneNumber: '+919999999994' },
];

export const adminPassword = 'Kash#8826';

export const expenses: Expense[] = [];

export const contributions: Contribution[] = [];

    
