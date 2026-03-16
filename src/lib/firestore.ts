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
  arrayUnion,
} from 'firebase/firestore';
import type {
  User,
  Expense,
  Contribution,
  ChatMessage,
  AuditLogEntry,
  AppConfig,
  TrackerSetupPayload,
  MemberSignupInput,
  MonthArchive,
  MonthArchiveSummary,
} from './types';
import { users as mockUsers, adminPassword as mockAdminPassword } from './data';
import { FirestorePermissionError } from './errors';
import { errorEmitter } from './error-emitter';

const DEFAULT_AVATAR = 'https://raw.githubusercontent.com/skyworld-play/tifresh-app/refs/heads/main/tifresh.png';

function sanitizeMemberId(value: string): string {
  const normalized = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || `member-${Date.now().toString(36)}`;
}

function normalizeIndianPhoneNumber(phoneNumber?: string): string | undefined {
  if (!phoneNumber) return undefined;
  const onlyDigits = phoneNumber.replace(/\D/g, '');
  if (onlyDigits.length === 10) {
    return `+91${onlyDigits}`;
  }
  if (phoneNumber.startsWith('+')) {
    return phoneNumber;
  }
  return undefined;
}

function generateGroupId(groupName: string): string {
  const slug = groupName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${slug || 'group'}-${suffix}`;
}

export async function addAdminAuditLog(entry: {
  action: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const auditCol = collection(db, 'auditLogs');
  const dataToSave = {
    actorId: 'admin',
    action: entry.action,
    metadata: entry.metadata || null,
    timestamp: Timestamp.now(),
  };

  try {
    await addDoc(auditCol, dataToSave);
  } catch (error) {
    const permissionError = new FirestorePermissionError({
      path: auditCol.path,
      operation: 'create',
      requestResourceData: {
        actorId: 'admin',
        action: entry.action,
      },
    });
    errorEmitter.emit('permission-error', permissionError);
    throw error;
  }
}

export async function getAppConfig(): Promise<AppConfig | null> {
  const configDocRef = doc(db, 'config', 'app');
  try {
    const configDoc = await getDoc(configDocRef);
    if (!configDoc.exists()) {
      return null;
    }
    return configDoc.data() as AppConfig;
  } catch (error) {
    const permissionError = new FirestorePermissionError({
      path: configDocRef.path,
      operation: 'get',
    });
    errorEmitter.emit('permission-error', permissionError);
    throw error;
  }
}

export async function isAppInitialized(): Promise<boolean> {
  const appConfig = await getAppConfig();
  return !!appConfig?.initialized;
}

export async function initializeTrackerInstance(payload: TrackerSetupPayload): Promise<void> {
  const appConfigRef = doc(db, 'config', 'app');
  const adminConfigRef = doc(db, 'config', 'admin');

  const existingConfig = await getDoc(appConfigRef);
  if (existingConfig.exists() && existingConfig.data()?.initialized) {
    throw new Error('Tracker is already initialized for this project.');
  }

  if (!payload.groupName.trim()) {
    throw new Error('Group name is required.');
  }
  if (!payload.members.length) {
    throw new Error('At least one member is required.');
  }
  if (payload.adminIndex < 0 || payload.adminIndex >= payload.members.length) {
    throw new Error('Please select a valid admin member.');
  }

  const normalizedMembers = payload.members.map((member) => ({
    ...member,
    name: member.name.trim(),
    pin: member.pin.trim(),
    phoneNumber: normalizeIndianPhoneNumber(member.phoneNumber),
    avatarUrl: member.avatarUrl || DEFAULT_AVATAR,
  }));

  normalizedMembers.forEach((member, index) => {
    if (!member.name) {
      throw new Error(`Member ${index + 1} name is required.`);
    }
    if (!/^\d{6}$/.test(member.pin)) {
      throw new Error(`Member ${index + 1} PIN must be exactly 6 digits.`);
    }
  });

  if (payload.adminPassword.trim().length < 8) {
    throw new Error('Admin password must be at least 8 characters.');
  }

  const batch = writeBatch(db);
  const usedIds = new Set<string>();

  normalizedMembers.forEach((member, index) => {
    const baseId = sanitizeMemberId(member.name);
    let nextId = baseId;
    let suffix = 2;
    while (usedIds.has(nextId)) {
      nextId = `${baseId}-${suffix}`;
      suffix += 1;
    }
    usedIds.add(nextId);

    if (index === payload.adminIndex) {
      return;
    }

    const userDocRef = doc(db, 'users', nextId);
    batch.set(userDocRef, {
      name: member.name,
      avatarUrl: member.avatarUrl,
      pin: member.pin,
      phoneNumber: member.phoneNumber || null,
      memberType: member.memberType || payload.memberTypeLabel || 'member',
    });
  });

  const adminMember = normalizedMembers[payload.adminIndex];
  batch.set(adminConfigRef, {
    password: payload.adminPassword,
    name: adminMember.name,
    avatarUrl: adminMember.avatarUrl,
    phoneNumber: adminMember.phoneNumber || null,
    memberType: adminMember.memberType || payload.memberTypeLabel || 'member',
  });

  const nowIso = new Date().toISOString();
  const groupId = generateGroupId(payload.groupName);
  batch.set(appConfigRef, {
    initialized: true,
    groupId,
    groupName: payload.groupName.trim(),
    groupImageUrl: payload.groupImageUrl || null,
    memberTypeLabel: payload.memberTypeLabel || 'member',
    adminName: adminMember.name,
    adminAvatarUrl: adminMember.avatarUrl,
    themePreference: payload.themePreference,
    modelApiKey: payload.modelApiKey || null,
    firebaseProjectConfig: payload.firebaseProjectConfig || null,
    currentPeriodStart: nowIso,
    createdAt: nowIso,
    updatedAt: nowIso,
  });

  try {
    await batch.commit();
  } catch (error) {
    const permissionError = new FirestorePermissionError({
      path: 'config/app + config/admin + users',
      operation: 'create',
    });
    errorEmitter.emit('permission-error', permissionError);
    throw error;
  }
}

export async function createMemberFromSignup(input: MemberSignupInput): Promise<User> {
  const name = input.name.trim();
  if (!name) {
    throw new Error('Name is required.');
  }
  if (!/^\d{6}$/.test(input.pin.trim())) {
    throw new Error('PIN must be exactly 6 digits.');
  }

  const existingUsers = await getAllUsers();
  const duplicateName = existingUsers.some((u) => u.name.toLowerCase() === name.toLowerCase());
  if (duplicateName) {
    throw new Error('A member with this name already exists.');
  }

  const baseId = sanitizeMemberId(name);
  let memberId = baseId;
  let suffix = 2;
  const usedIds = new Set(existingUsers.map((u) => u.id));
  while (usedIds.has(memberId)) {
    memberId = `${baseId}-${suffix}`;
    suffix += 1;
  }

  const userRecord: Omit<User, 'id'> = {
    name,
    avatarUrl: input.avatarUrl || DEFAULT_AVATAR,
    pin: input.pin.trim(),
    phoneNumber: normalizeIndianPhoneNumber(input.phoneNumber),
    memberType: input.memberType || 'member',
  };

  const userDocRef = doc(db, 'users', memberId);
  try {
    await setDoc(userDocRef, userRecord);
    return { id: memberId, ...userRecord };
  } catch (error) {
    const permissionError = new FirestorePermissionError({
      path: userDocRef.path,
      operation: 'create',
      requestResourceData: { ...userRecord, pin: 'REDACTED' },
    });
    errorEmitter.emit('permission-error', permissionError);
    throw error;
  }
}

// --- User Functions ---

export function subscribeToUsers(callback: (users: User[]) => void): () => void {
  const usersCol = collection(db, 'users');
  const q = query(usersCol, orderBy('name', 'asc'));
  const unsubscribe = onSnapshot(q, (snapshot) => {
    const userList = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() } as User))
      .filter(user => user.id !== 'admin'); // Don't include admin as a regular user
    callback(userList);
  }, () => {
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
            const configDocRef = doc(db, 'config', 'admin');
            const configDoc = await getDoc(configDocRef);
            if (configDoc.exists()) {
              const data = configDoc.data();
              return {
                id: 'admin',
                name: data.name || 'Admin',
                avatarUrl: data.avatarUrl || DEFAULT_AVATAR,
                pin: data.password || '',
                phoneNumber: data.phoneNumber || undefined,
                memberType: data.memberType || 'admin',
              };
            }
            const password = await getAdminPassword();
            return { id: 'admin', name: 'Admin', avatarUrl: DEFAULT_AVATAR, pin: password || '' };
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
    try {
      await updateDoc(configDocRef, { password: newCredential });
    } catch (error) {
            const permissionError = new FirestorePermissionError({
              path: configDocRef.path,
              operation: 'update',
              requestResourceData: { password: 'REDACTED' },
            });
            errorEmitter.emit('permission-error', permissionError);
      throw error;
    }
    } else {
        const userDocRef = doc(db, 'users', userId);
    try {
      await updateDoc(userDocRef, { pin: newCredential });
    } catch (error) {
            const permissionError = new FirestorePermissionError({
              path: userDocRef.path,
              operation: 'update',
              requestResourceData: { pin: 'REDACTED' },
            });
            errorEmitter.emit('permission-error', permissionError);
      throw error;
    }
    }
}

export async function updateUserPhoneNumber(userId: string, phoneNumber: string): Promise<void> {
    if (!userId) throw new Error("User ID is required.");
    const userDocRef = doc(db, 'users', userId);
  try {
    await updateDoc(userDocRef, { phoneNumber: phoneNumber });
  } catch (error) {
        const permissionError = new FirestorePermissionError({
            path: userDocRef.path,
            operation: 'update',
            requestResourceData: { phoneNumber },
        });
        errorEmitter.emit('permission-error', permissionError);
    throw error;
  }
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
  }, () => {
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
  try {
    await addDoc(expenseCol, dataToSave);
  } catch (error) {
      const permissionError = new FirestorePermissionError({
        path: expenseCol.path,
        operation: 'create',
        requestResourceData: dataToSave,
      });
      errorEmitter.emit('permission-error', permissionError);
      throw error;
  }
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
  }, () => {
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
  try {
    await addDoc(contributionCol, dataToSave);
  } catch (error) {
        const permissionError = new FirestorePermissionError({
            path: contributionCol.path,
            operation: 'create',
            requestResourceData: dataToSave,
        });
        errorEmitter.emit('permission-error', permissionError);
    throw error;
  }
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
  }, () => {
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
  try {
    await addDoc(messagesCol, dataToSave);
  } catch (error) {
    const permissionError = new FirestorePermissionError({
        path: messagesCol.path,
        operation: 'create',
        requestResourceData: dataToSave,
    });
    errorEmitter.emit('permission-error', permissionError);
    throw error;
  }
}

export function subscribeToAuditLogs(
  count: number,
  callback: (logs: AuditLogEntry[]) => void,
  lastVisible?: AuditLogEntry,
): () => void {
  const auditCol = collection(db, 'auditLogs');
  let q = query(auditCol, orderBy('timestamp', 'desc'), limit(count));

  if (lastVisible) {
    q = query(
      auditCol,
      orderBy('timestamp', 'desc'),
      startAfter(Timestamp.fromMillis(Date.parse(lastVisible.timestamp))),
      limit(count),
    );
  }

  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const logList = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          actorId: (data.actorId as string) || 'admin',
          action: (data.action as string) || 'unknown',
          metadata: (data.metadata as Record<string, unknown> | null) || null,
          timestamp: (data.timestamp as Timestamp).toDate().toISOString(),
        } as AuditLogEntry;
      });
      callback(logList);
    },
    () => {
      const permissionError = new FirestorePermissionError({
        path: auditCol.path,
        operation: 'list',
      });
      errorEmitter.emit('permission-error', permissionError);
      callback([]);
    },
  );

  return unsubscribe;
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
  try {
    await batch.commit();
  } catch (error) {
      const permissionError = new FirestorePermissionError({
        path: 'messages/[multiple]',
        operation: 'update',
        requestResourceData: { readBy: `arrayUnion(${userId})` },
      });
      errorEmitter.emit('permission-error', permissionError);
      throw error;
  }
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

export async function getMonthArchives(): Promise<MonthArchiveSummary[]> {
  const archivesCol = collection(db, 'monthArchives');
  const q = query(archivesCol, orderBy('periodEnd', 'desc'));
  try {
    const snapshot = await getDocs(q);
    return snapshot.docs.map((entry) => {
      const data = entry.data();
      const archivedAtRaw = data.archivedAt as Timestamp | string | undefined;
      return {
        id: entry.id,
        groupId: data.groupId as string | undefined,
        periodLabel: (data.periodLabel as string) || 'Archived Period',
        periodStart: (data.periodStart as string) || '',
        periodEnd: (data.periodEnd as string) || '',
        expenseCount: Number(data.expenseCount || 0),
        contributionCount: Number(data.contributionCount || 0),
        messageCount: Number(data.messageCount || 0),
        archivedAt:
          typeof archivedAtRaw === 'string'
            ? archivedAtRaw
            : archivedAtRaw?.toDate().toISOString() || '',
      } as MonthArchiveSummary;
    });
  } catch (error) {
    const permissionError = new FirestorePermissionError({
      path: archivesCol.path,
      operation: 'list',
    });
    errorEmitter.emit('permission-error', permissionError);
    throw error;
  }
}

export async function getMonthArchiveById(
  archiveId: string,
): Promise<MonthArchive | null> {
  const archiveRef = doc(db, 'monthArchives', archiveId);
  try {
    const snapshot = await getDoc(archiveRef);
    if (!snapshot.exists()) {
      return null;
    }

    const data = snapshot.data();
    const archivedAtRaw = data.archivedAt as Timestamp | string | undefined;
    return {
      id: snapshot.id,
      groupId: data.groupId as string | undefined,
      periodLabel: (data.periodLabel as string) || 'Archived Period',
      periodStart: (data.periodStart as string) || '',
      periodEnd: (data.periodEnd as string) || '',
      expenseCount: Number(data.expenseCount || 0),
      contributionCount: Number(data.contributionCount || 0),
      messageCount: Number(data.messageCount || 0),
      archivedAt:
        typeof archivedAtRaw === 'string'
          ? archivedAtRaw
          : archivedAtRaw?.toDate().toISOString() || '',
      expenses: (data.expenses as Expense[]) || [],
      contributions: (data.contributions as Contribution[]) || [],
      messages: (data.messages as ChatMessage[]) || [],
    };
  } catch (error) {
    const permissionError = new FirestorePermissionError({
      path: archiveRef.path,
      operation: 'get',
    });
    errorEmitter.emit('permission-error', permissionError);
    throw error;
  }
}

export async function rolloverMonthWithArchive(): Promise<MonthArchiveSummary> {
  const [appConfig, expenses, contributions, messages] = await Promise.all([
    getAppConfig(),
    getAllExpensesForReport(),
    getAllContributionsForReport(),
    getAllChatMessages(),
  ]);

  const now = new Date();
  const nowIso = now.toISOString();
  const periodStart = appConfig?.currentPeriodStart || appConfig?.createdAt || nowIso;
  const periodStartDate = new Date(periodStart);
  const periodLabel = Number.isNaN(periodStartDate.getTime())
    ? `Period ending ${now.toLocaleDateString()}`
    : `${periodStartDate.toLocaleString('en-US', { month: 'short' })} ${periodStartDate.getFullYear()}`;

  const archiveRef = doc(collection(db, 'monthArchives'));
  const archivesData = {
    groupId: appConfig?.groupId || null,
    periodLabel,
    periodStart,
    periodEnd: nowIso,
    expenseCount: expenses.length,
    contributionCount: contributions.length,
    messageCount: messages.length,
    archivedAt: Timestamp.now(),
    expenses,
    contributions,
    messages,
  };

  const appConfigRef = doc(db, 'config', 'app');
  const collectionsToClear = ['expenses', 'contributions', 'messages'];
  const batch = writeBatch(db);
  batch.set(archiveRef, archivesData);

  if (appConfig?.initialized) {
    batch.update(appConfigRef, {
      currentPeriodStart: nowIso,
      updatedAt: nowIso,
    });
  }

  for (const collectionName of collectionsToClear) {
    const snapshot = await getDocs(collection(db, collectionName));
    snapshot.docs.forEach((entry) => {
      batch.delete(entry.ref);
    });
  }

  try {
    await batch.commit();
    return {
      id: archiveRef.id,
      groupId: appConfig?.groupId,
      periodLabel,
      periodStart,
      periodEnd: nowIso,
      expenseCount: expenses.length,
      contributionCount: contributions.length,
      messageCount: messages.length,
      archivedAt: nowIso,
    };
  } catch (error) {
    const permissionError = new FirestorePermissionError({
      path: 'monthArchives + config/app + live collections',
      operation: 'create',
    });
    errorEmitter.emit('permission-error', permissionError);
    throw error;
  }
}


// --- Data Seeding Function ---
export async function seedDatabase() {
    const appConfig = await getAppConfig();
    if (appConfig?.initialized) {
      return;
    }

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
