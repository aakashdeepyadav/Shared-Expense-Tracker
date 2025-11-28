// src/lib/firestore.ts
import { db } from './firebase';
import {
  collection,
  getDocs,
  doc,
  getDoc,
  addDoc,
  updateDoc,
  query,
  orderBy,
  limit,
  Timestamp,
  writeBatch,
  onSnapshot,
  setDoc,
  startAfter,
  QueryDocumentSnapshot,
  deleteDoc,
  arrayUnion,
} from 'firebase/firestore';
import type { User, Expense, Contribution, ChatMessage } from './types';
import { users as mockUsers, adminPassword as mockAdminPassword } from './data';
import { FirestorePermissionError } from './errors';
import { errorEmitter } from './error-emitter';

// --- User Functions ---

export function subscribeToUsers(callback: (users: User[]) => void): () => void {
  const usersCol = collection(db, 'users');
  const q = query(usersCol, orderBy('name', 'asc'));
  const unsubscribe = onSnapshot(q, (snapshot) => {
    const userList = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() } as User))
      .filter(user => user.id !== 'admin'); // Don't include admin as a regular user
    callback(userList);
  }, (error) => {
    const permissionError = new FirestorePermissionError({
      path: usersCol.path,
      operation: 'list',
    });
    errorEmitter.emit('permission-error', permissionError);
    callback([]);
  });
  return unsubscribe;
}


export async function getAllUsers(): Promise<User[]> {
  const usersCol = collection(db, 'users');
  try {
    const userSnapshot = await getDocs(usersCol);
    const userList = userSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
    return userList.filter(user => user.id !== 'admin');
  } catch (error) {
    const permissionError = new FirestorePermissionError({
        path: usersCol.path,
        operation: 'list',
    });
    errorEmitter.emit('permission-error', permissionError);
    throw error;
  }
}

export async function getUser(id: string): Promise<User | null> {
    const userDocRef = doc(db, 'users', id);
    try {
        if (id === 'admin') {
            const password = await getAdminPassword();
            return { id: 'admin', name: 'Admin', avatarUrl: 'https://raw.githubusercontent.com/skyworld-play/tifresh-app/refs/heads/main/tifresh.png', pin: password || '' };
        }
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
            return { id: userDoc.id, ...userDoc.data() } as User;
        }
        return null;
    } catch (error) {
        const permissionError = new FirestorePermissionError({
            path: userDocRef.path,
            operation: 'get',
        });
        errorEmitter.emit('permission-error', permissionError);
        throw error;
    }
}

export async function updateUserCredential(userId: string, newCredential: string, isAdmin: boolean): Promise<void> {
    if (isAdmin) {
        const configDocRef = doc(db, 'config', 'admin');
        updateDoc(configDocRef, { password: newCredential }).catch(async () => {
            const permissionError = new FirestorePermissionError({
              path: configDocRef.path,
              operation: 'update',
              requestResourceData: { password: 'REDACTED' },
            });
            errorEmitter.emit('permission-error', permissionError);
        });
    } else {
        const userDocRef = doc(db, 'users', userId);
        updateDoc(userDocRef, { pin: newCredential }).catch(async () => {
            const permissionError = new FirestorePermissionError({
              path: userDocRef.path,
              operation: 'update',
              requestResourceData: { pin: 'REDACTED' },
            });
            errorEmitter.emit('permission-error', permissionError);
        });
    }
}

export async function updateUserPhoneNumber(userId: string, phoneNumber: string): Promise<void> {
    if (!userId) throw new Error("User ID is required.");
    const userDocRef = doc(db, 'users', userId);
    updateDoc(userDocRef, { phoneNumber: phoneNumber }).catch(async () => {
        const permissionError = new FirestorePermissionError({
            path: userDocRef.path,
            operation: 'update',
            requestResourceData: { phoneNumber },
        });
        errorEmitter.emit('permission-error', permissionError);
    });
}

// --- Admin Password Functions ---
export async function getAdminPassword(): Promise<string | null> {
  const configDocRef = doc(db, 'config', 'admin');
  try {
    const configDoc = await getDoc(configDocRef);
    if (configDoc.exists()) {
        return configDoc.data().password;
    }
    return null;
  } catch(error) {
    const permissionError = new FirestorePermissionError({
        path: configDocRef.path,
        operation: 'get',
    });
    errorEmitter.emit('permission-error', permissionError);
    throw error;
  }
}

async function getDocSnapshot(docId: string, collectionName: string): Promise<QueryDocumentSnapshot | undefined> {
  const docRef = doc(db, collectionName, docId);
  try {
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
          // This snapshot can be used in startAfter, but it's not the exact same object
          // from a query. For robust pagination, it's better to pass the full object from the query result.
          // However, for simplicity here, we re-fetch.
          return docSnap as QueryDocumentSnapshot;
      }
  } catch(error) {
    // This is an internal helper, but we can still wire it up.
     const permissionError = new FirestorePermissionError({
        path: docRef.path,
        operation: 'get',
    });
    errorEmitter.emit('permission-error', permissionError);
  }
  return undefined;
}


// --- Expense Functions ---
export function subscribeToExpenses(
  count: number, 
  callback: (expenses: Expense[]) => void,
  lastVisible?: Expense
): () => void {
  const expensesCol = collection(db, 'expenses');
  let q = query(expensesCol, orderBy('date', 'desc'), limit(count));

  if (lastVisible) {
    q = query(expensesCol, orderBy('date', 'desc'), startAfter(Timestamp.fromMillis(Date.parse(lastVisible.date))), limit(count));
  }
  
  const unsubscribe = onSnapshot(q, (snapshot) => {
    const expenseList = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        date: (data.date as Timestamp).toDate().toISOString(),
      } as Expense;
    });
    callback(expenseList);
  }, (error) => {
    const permissionError = new FirestorePermissionError({
        path: expensesCol.path,
        operation: 'list',
    });
    errorEmitter.emit('permission-error', permissionError);
    callback([]);
  });

  return unsubscribe;
}


export async function addExpense(expenseData: Omit<Expense, 'id'| 'date'> & { date: Date }): Promise<void> {
  const expenseCol = collection(db, 'expenses');
  const dataToSave = {
      ...expenseData,
      date: Timestamp.fromDate(expenseData.date)
  };
  addDoc(expenseCol, dataToSave).catch(async () => {
      const permissionError = new FirestorePermissionError({
        path: expenseCol.path,
        operation: 'create',
        requestResourceData: dataToSave,
      });
      errorEmitter.emit('permission-error', permissionError);
  });
}


// --- Contribution Functions ---
export function subscribeToContributions(
  count: number, 
  callback: (contributions: Contribution[]) => void,
  lastVisible?: Contribution
): () => void {
  const contributionsCol = collection(db, 'contributions');
  let q = query(contributionsCol, orderBy('date', 'desc'), limit(count));

  if (lastVisible) {
     q = query(contributionsCol, orderBy('date', 'desc'), startAfter(Timestamp.fromMillis(Date.parse(lastVisible.date))), limit(count));
  }
    
  const unsubscribe = onSnapshot(q, (snapshot) => {
    const contributionList = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        date: (data.date as Timestamp).toDate().toISOString().split('T')[0],
      } as Contribution;
    });
    callback(contributionList);
  }, (error) => {
    const permissionError = new FirestorePermissionError({
      path: contributionsCol.path,
      operation: 'list',
    });
    errorEmitter.emit('permission-error', permissionError);
    callback([]);
  });

  return unsubscribe;
}


export async function addContribution(contributionData: Omit<Contribution, 'id' | 'date'> & { date: Date }): Promise<void> {
    const contributionCol = collection(db, 'contributions');
    const dataToSave = {
        ...contributionData,
        date: Timestamp.fromDate(contributionData.date)
    };
    addDoc(contributionCol, dataToSave).catch(async () => {
        const permissionError = new FirestorePermissionError({
            path: contributionCol.path,
            operation: 'create',
            requestResourceData: dataToSave,
        });
        errorEmitter.emit('permission-error', permissionError);
    });
}

// --- Chat Functions ---

export function subscribeToMessages(callback: (messages: ChatMessage[]) => void): () => void {
  const messagesCol = collection(db, 'messages');
  const q = query(messagesCol, orderBy('timestamp', 'asc'), limit(100)); // Get last 100 messages

  const unsubscribe = onSnapshot(q, (snapshot) => {
    const messageList = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        timestamp: (data.timestamp as Timestamp).toDate().toISOString(),
        readBy: data.readBy || [],
      } as ChatMessage;
    });
    callback(messageList);
  }, (error) => {
    const permissionError = new FirestorePermissionError({
        path: messagesCol.path,
        operation: 'list',
    });
    errorEmitter.emit('permission-error', permissionError);
    callback([]);
  });

  return unsubscribe;
}

export async function addMessage(message: Omit<ChatMessage, 'id' | 'timestamp' | 'readBy'>): Promise<void> {
  const messagesCol = collection(db, 'messages');
  const dataToSave = {
    ...message,
    timestamp: Timestamp.now(),
    readBy: [message.userId],
  };
  addDoc(messagesCol, dataToSave).catch(async () => {
    const permissionError = new FirestorePermissionError({
        path: messagesCol.path,
        operation: 'create',
        requestResourceData: dataToSave,
    });
    errorEmitter.emit('permission-error', permissionError);
  });
}

export async function markMessagesAsRead(messageIds: string[], userId: string): Promise<void> {
  if (messageIds.length === 0) return;
  const batch = writeBatch(db);
  messageIds.forEach(id => {
    const messageRef = doc(db, 'messages', id);
    batch.update(messageRef, {
      readBy: arrayUnion(userId)
    });
  });
  batch.commit().catch(async () => {
      const permissionError = new FirestorePermissionError({
        path: 'messages/[multiple]',
        operation: 'update',
        requestResourceData: { readBy: `arrayUnion(${userId})` },
      });
      errorEmitter.emit('permission-error', permissionError);
  });
}

// --- Report & Archive Data Functions ---
export async function getAllExpensesForReport(): Promise<Expense[]> {
  const expensesCol = collection(db, 'expenses');
  const q = query(expensesCol, orderBy('date', 'asc'));
  try {
    const expenseSnapshot = await getDocs(q);
    return expenseSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        date: (data.date as Timestamp).toDate().toISOString(),
      } as Expense;
    });
  } catch (error) {
    const permissionError = new FirestorePermissionError({ path: expensesCol.path, operation: 'list' });
    errorEmitter.emit('permission-error', permissionError);
    throw error;
  }
}

export async function getAllContributionsForReport(): Promise<Contribution[]> {
    const contributionsCol = collection(db, 'contributions');
    const q = query(contributionsCol, orderBy('date', 'asc'));
  try {
    const contributionSnapshot = await getDocs(q);
    return contributionSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        date: (data.date as Timestamp).toDate().toISOString().split('T')[0],
      } as Contribution;
    });
  } catch (error) {
    const permissionError = new FirestorePermissionError({ path: contributionsCol.path, operation: 'list' });
    errorEmitter.emit('permission-error', permissionError);
    throw error;
  }
}

export async function getAllChatMessages(): Promise<ChatMessage[]> {
    const messagesCol = collection(db, 'messages');
    const q = query(messagesCol, orderBy('timestamp', 'asc'));
  try {
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        timestamp: (data.timestamp as Timestamp).toDate().toISOString(),
        readBy: data.readBy || [],
      } as ChatMessage;
    });
  } catch (error) {
    const permissionError = new FirestorePermissionError({ path: messagesCol.path, operation: 'list' });
    errorEmitter.emit('permission-error', permissionError);
    throw error;
  }
}

export async function clearAllData(): Promise<void> {
  const collectionsToClear = ['expenses', 'contributions', 'messages'];
  const batch = writeBatch(db);
  
  try {
      for (const collectionName of collectionsToClear) {
        const snapshot = await getDocs(collection(db, collectionName));
        snapshot.docs.forEach(doc => {
          batch.delete(doc.ref);
        });
      }
      await batch.commit();
  } catch (error) {
      const permissionError = new FirestorePermissionError({
          path: `[${collectionsToClear.join(', ')}]`,
          operation: 'delete',
      });
      errorEmitter.emit('permission-error', permissionError);
      throw error;
  }
}


// --- Data Seeding Function ---
export async function seedDatabase() {
    const usersCol = collection(db, 'users');
  try {
    const usersSnapshot = await getDocs(query(usersCol, limit(1)));
    
    if (usersSnapshot.empty) {
      console.log('No users found. Seeding database...');
      const batch = writeBatch(db);

      mockUsers.forEach(user => {
        const { id, ...userData } = user;
        const userDocRef = doc(db, 'users', id);
        batch.set(userDocRef, userData);
      });

      const configDocRef = doc(db, 'config', 'admin');
      batch.set(configDocRef, { password: mockAdminPassword });

      await batch.commit();
      console.log('Database seeded successfully.');
    }
  } catch (error) {
    const permissionError = new FirestorePermissionError({
      path: usersCol.path,
      operation: 'list',
    });
    errorEmitter.emit('permission-error', permissionError);
    throw error;
  }
}
