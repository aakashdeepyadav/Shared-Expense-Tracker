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
  where,
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
  GroupDirectoryEntry,
} from './types';
import { FirestorePermissionError } from './errors';
import { errorEmitter } from './error-emitter';

const DEFAULT_AVATAR = 'https://placehold.co/128x128/png?text=User';
const ARCHIVE_RETENTION_DAYS = 365;
const ACTIVE_GROUP_STORAGE_KEY = 'shared-expense-tracker-groupid';
let inMemoryActiveGroupId: string | null = null;

function sanitizeMemberId(value: string): string {
  const normalized = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || `member-${Date.now().toString(36)}`;
}

function sanitizeGroupId(value: string): string {
  const normalized = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized;
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

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

function groupRootDoc(groupId: string) {
  return doc(db, 'groups', groupId);
}

function groupConfigDoc(groupId: string, configId: 'app' | 'admin') {
  return doc(db, 'groups', groupId, 'config', configId);
}

function groupCollection(groupId: string, collectionName: string) {
  return collection(db, 'groups', groupId, collectionName);
}

function resolveGroupId(groupId?: string): string {
  const resolved = sanitizeGroupId(groupId || getActiveGroupId() || '');
  if (!resolved) {
    throw new Error('No active group selected. Please join or create a group first.');
  }
  return resolved;
}

export function getActiveGroupId(): string | null {
  if (isBrowser()) {
    try {
      return localStorage.getItem(ACTIVE_GROUP_STORAGE_KEY);
    } catch {
      return inMemoryActiveGroupId;
    }
  }
  return inMemoryActiveGroupId;
}

export function setActiveGroupId(groupId: string): void {
  const sanitized = sanitizeGroupId(groupId);
  if (!sanitized) {
    throw new Error('Group ID is required.');
  }
  inMemoryActiveGroupId = sanitized;
  if (isBrowser()) {
    try {
      localStorage.setItem(ACTIVE_GROUP_STORAGE_KEY, sanitized);
    } catch (error) {
      console.error('Could not persist active group ID in localStorage', error);
    }
  }
}

export function clearActiveGroupId(): void {
  inMemoryActiveGroupId = null;
  if (isBrowser()) {
    try {
      localStorage.removeItem(ACTIVE_GROUP_STORAGE_KEY);
    } catch (error) {
      console.error('Could not clear active group ID from localStorage', error);
    }
  }
}

export async function getGroupDirectory(): Promise<GroupDirectoryEntry[]> {
  const groupsCol = collection(db, 'groups');
  const q = query(groupsCol, orderBy('groupName', 'asc'));
  try {
    const snapshot = await getDocs(q);
    return snapshot.docs
      .filter((entry) => (entry.data().initialized as boolean) === true)
      .map((entry) => {
        const data = entry.data();
        return {
          id: entry.id,
          groupName: (data.groupName as string) || 'Unnamed Group',
          groupImageUrl: (data.groupImageUrl as string) || undefined,
          memberTypeLabel: (data.memberTypeLabel as string) || 'member',
          createdAt: (data.createdAt as string) || undefined,
          updatedAt: (data.updatedAt as string) || undefined,
        } satisfies GroupDirectoryEntry;
      });
  } catch (error) {
    const permissionError = new FirestorePermissionError({
      path: groupsCol.path,
      operation: 'list',
    });
    errorEmitter.emit('permission-error', permissionError);
    throw error;
  }
}

export async function selectGroupById(groupId: string): Promise<AppConfig> {
  const selectedGroupId = resolveGroupId(groupId);
  const appConfig = await getAppConfig(selectedGroupId);
  if (!appConfig?.initialized) {
    throw new Error('Selected group does not exist or setup is incomplete.');
  }
  setActiveGroupId(selectedGroupId);
  return appConfig;
}

export async function addAdminAuditLog(
  entry: {
    action: string;
    metadata?: Record<string, unknown>;
  },
  groupId?: string,
): Promise<void> {
  const resolvedGroupId = resolveGroupId(groupId);
  const auditCol = groupCollection(resolvedGroupId, 'auditLogs');
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

export async function getAppConfig(groupId?: string): Promise<AppConfig | null> {
  const activeGroupId = groupId || getActiveGroupId();
  if (!activeGroupId) {
    return null;
  }

  const configDocRef = groupConfigDoc(resolveGroupId(activeGroupId), 'app');
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

export async function initializeTrackerInstance(payload: TrackerSetupPayload): Promise<string> {
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

  let groupId = sanitizeGroupId(payload.groupId || generateGroupId(payload.groupName));
  if (!groupId) {
    groupId = generateGroupId(payload.groupName);
  }

  // Ensure we never overwrite an existing group.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const rootSnapshot = await getDoc(groupRootDoc(groupId));
    if (!rootSnapshot.exists()) {
      break;
    }
    if ((rootSnapshot.data()?.initialized as boolean) === true) {
      groupId = generateGroupId(payload.groupName);
    }
  }

  const rootRef = groupRootDoc(groupId);
  const appConfigRef = groupConfigDoc(groupId, 'app');
  const adminConfigRef = groupConfigDoc(groupId, 'admin');

  const existingConfig = await getDoc(appConfigRef);
  if (existingConfig.exists() && existingConfig.data()?.initialized) {
    throw new Error('This group ID is already initialized. Please try a different group.');
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

    const userDocRef = doc(db, 'groups', groupId, 'users', nextId);
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
    pin: adminMember.pin,
    name: adminMember.name,
    avatarUrl: adminMember.avatarUrl,
    phoneNumber: adminMember.phoneNumber || null,
    memberType: adminMember.memberType || payload.memberTypeLabel || 'member',
  });

  const nowIso = new Date().toISOString();
  const appConfigPayload = {
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
  };

  batch.set(rootRef, {
    initialized: true,
    groupName: payload.groupName.trim(),
    groupImageUrl: payload.groupImageUrl || null,
    memberTypeLabel: payload.memberTypeLabel || 'member',
    createdAt: nowIso,
    updatedAt: nowIso,
  });

  batch.set(appConfigRef, appConfigPayload);

  try {
    await batch.commit();
    setActiveGroupId(groupId);
    return groupId;
  } catch (error) {
    const permissionError = new FirestorePermissionError({
      path: `groups/${groupId}/config + users`,
      operation: 'create',
    });
    errorEmitter.emit('permission-error', permissionError);
    throw error;
  }
}

export async function createMemberFromSignup(input: MemberSignupInput): Promise<User> {
  const resolvedGroupId = resolveGroupId();
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

  const userDocRef = doc(db, 'groups', resolvedGroupId, 'users', memberId);
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

async function getAdminAsUser(groupId?: string): Promise<User | null> {
  const resolvedGroupId = resolveGroupId(groupId);
  const adminConfigRef = groupConfigDoc(resolvedGroupId, 'admin');
  const adminSnapshot = await getDoc(adminConfigRef);
  if (!adminSnapshot.exists()) {
    return null;
  }
  const data = adminSnapshot.data();
  return {
    id: 'admin',
    name: (data.name as string) || 'Admin',
    avatarUrl: (data.avatarUrl as string) || DEFAULT_AVATAR,
    pin: (data.pin as string) || '',
    phoneNumber: (data.phoneNumber as string) || undefined,
    memberType: (data.memberType as string) || 'member',
  };
}

export function subscribeToUsers(callback: (users: User[]) => void): () => void {
  const resolvedGroupId = resolveGroupId();
  const usersCol = groupCollection(resolvedGroupId, 'users');
  const q = query(usersCol, orderBy('name', 'asc'));
  const unsubscribe = onSnapshot(
    q,
    async (snapshot) => {
      const userList = snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }) as User);

      const hasAdminInUsers = userList.some((user) => user.id === 'admin');
      if (!hasAdminInUsers) {
        try {
          const adminUser = await getAdminAsUser(resolvedGroupId);
          if (adminUser) {
            userList.push(adminUser);
          }
        } catch {
          // Keep member list functional even if admin profile lookup fails.
        }
      }

      callback(userList.sort((a, b) => a.name.localeCompare(b.name)));
    },
    () => {
      const permissionError = new FirestorePermissionError({
        path: usersCol.path,
        operation: 'list',
      });
      errorEmitter.emit('permission-error', permissionError);
      callback([]);
    },
  );
  return unsubscribe;
}

export async function getAllUsers(): Promise<User[]> {
  const resolvedGroupId = resolveGroupId();
  const usersCol = groupCollection(resolvedGroupId, 'users');
  try {
    const userSnapshot = await getDocs(usersCol);
    const userList = userSnapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }) as User);

    const hasAdminInUsers = userList.some((user) => user.id === 'admin');
    if (!hasAdminInUsers) {
      const adminUser = await getAdminAsUser(resolvedGroupId);
      if (adminUser) {
        userList.push(adminUser);
      }
    }

    return userList.sort((a, b) => a.name.localeCompare(b.name));
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
  const resolvedGroupId = resolveGroupId();
  const userDocRef = doc(db, 'groups', resolvedGroupId, 'users', id);
  try {
    if (id === 'admin') {
      const configDocRef = groupConfigDoc(resolvedGroupId, 'admin');
      const configDoc = await getDoc(configDocRef);
      if (configDoc.exists()) {
        const data = configDoc.data();
        return {
          id: 'admin',
          name: (data.name as string) || 'Admin',
          avatarUrl: (data.avatarUrl as string) || DEFAULT_AVATAR,
          pin: (data.pin as string) || '',
          phoneNumber: (data.phoneNumber as string) || undefined,
          memberType: (data.memberType as string) || 'member',
        };
      }
      return { id: 'admin', name: 'Admin', avatarUrl: DEFAULT_AVATAR, pin: '' };
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
  const resolvedGroupId = resolveGroupId();
  if (isAdmin) {
    const configDocRef = groupConfigDoc(resolvedGroupId, 'admin');
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
    const userDocRef = doc(db, 'groups', resolvedGroupId, 'users', userId);
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
  const resolvedGroupId = resolveGroupId();
  if (!userId) throw new Error('User ID is required.');

  if (userId === 'admin') {
    const adminConfigRef = groupConfigDoc(resolvedGroupId, 'admin');
    try {
      await updateDoc(adminConfigRef, { phoneNumber });
      return;
    } catch (error) {
      const permissionError = new FirestorePermissionError({
        path: adminConfigRef.path,
        operation: 'update',
        requestResourceData: { phoneNumber },
      });
      errorEmitter.emit('permission-error', permissionError);
      throw error;
    }
  }

  const userDocRef = doc(db, 'groups', resolvedGroupId, 'users', userId);
  try {
    await updateDoc(userDocRef, { phoneNumber });
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
  const resolvedGroupId = resolveGroupId();
  const configDocRef = groupConfigDoc(resolvedGroupId, 'admin');
  try {
    const configDoc = await getDoc(configDocRef);
    if (configDoc.exists()) {
      return configDoc.data().password;
    }
    return null;
  } catch (error) {
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
  lastVisible?: Expense,
): () => void {
  const resolvedGroupId = resolveGroupId();
  const expensesCol = groupCollection(resolvedGroupId, 'expenses');
  let q = query(expensesCol, orderBy('date', 'desc'), limit(count));

  if (lastVisible) {
    q = query(
      expensesCol,
      orderBy('date', 'desc'),
      startAfter(Timestamp.fromMillis(Date.parse(lastVisible.date))),
      limit(count),
    );
  }

  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const expenseList = snapshot.docs.map((entry) => {
        const data = entry.data();
        return {
          id: entry.id,
          ...data,
          date: (data.date as Timestamp).toDate().toISOString(),
        } as Expense;
      });
      callback(expenseList);
    },
    () => {
      const permissionError = new FirestorePermissionError({
        path: expensesCol.path,
        operation: 'list',
      });
      errorEmitter.emit('permission-error', permissionError);
      callback([]);
    },
  );

  return unsubscribe;
}

export async function addExpense(expenseData: Omit<Expense, 'id' | 'date'> & { date: Date }): Promise<void> {
  const resolvedGroupId = resolveGroupId();
  const expenseCol = groupCollection(resolvedGroupId, 'expenses');
  const dataToSave = {
    ...expenseData,
    date: Timestamp.fromDate(expenseData.date),
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
  lastVisible?: Contribution,
): () => void {
  const resolvedGroupId = resolveGroupId();
  const contributionsCol = groupCollection(resolvedGroupId, 'contributions');
  let q = query(contributionsCol, orderBy('date', 'desc'), limit(count));

  if (lastVisible) {
    q = query(
      contributionsCol,
      orderBy('date', 'desc'),
      startAfter(Timestamp.fromMillis(Date.parse(lastVisible.date))),
      limit(count),
    );
  }

  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const contributionList = snapshot.docs.map((entry) => {
        const data = entry.data();
        return {
          id: entry.id,
          ...data,
          date: (data.date as Timestamp).toDate().toISOString().split('T')[0],
        } as Contribution;
      });
      callback(contributionList);
    },
    () => {
      const permissionError = new FirestorePermissionError({
        path: contributionsCol.path,
        operation: 'list',
      });
      errorEmitter.emit('permission-error', permissionError);
      callback([]);
    },
  );

  return unsubscribe;
}

export async function addContribution(
  contributionData: Omit<Contribution, 'id' | 'date'> & { date: Date },
): Promise<void> {
  const resolvedGroupId = resolveGroupId();
  const contributionCol = groupCollection(resolvedGroupId, 'contributions');
  const dataToSave = {
    ...contributionData,
    date: Timestamp.fromDate(contributionData.date),
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
  const resolvedGroupId = resolveGroupId();
  const messagesCol = groupCollection(resolvedGroupId, 'messages');
  const q = query(messagesCol, orderBy('timestamp', 'asc'), limit(100));

  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const messageList = snapshot.docs.map((entry) => {
        const data = entry.data();
        return {
          id: entry.id,
          ...data,
          timestamp: (data.timestamp as Timestamp).toDate().toISOString(),
          readBy: (data.readBy as string[]) || [],
        } as ChatMessage;
      });
      callback(messageList);
    },
    () => {
      const permissionError = new FirestorePermissionError({
        path: messagesCol.path,
        operation: 'list',
      });
      errorEmitter.emit('permission-error', permissionError);
      callback([]);
    },
  );

  return unsubscribe;
}

export async function addMessage(message: Omit<ChatMessage, 'id' | 'timestamp' | 'readBy'>): Promise<void> {
  const resolvedGroupId = resolveGroupId();
  const messagesCol = groupCollection(resolvedGroupId, 'messages');
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
  const resolvedGroupId = resolveGroupId();
  const auditCol = groupCollection(resolvedGroupId, 'auditLogs');
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
      const logList = snapshot.docs.map((entry) => {
        const data = entry.data();
        return {
          id: entry.id,
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
  const resolvedGroupId = resolveGroupId();
  const batch = writeBatch(db);
  messageIds.forEach((id) => {
    const messageRef = doc(db, 'groups', resolvedGroupId, 'messages', id);
    batch.update(messageRef, {
      readBy: arrayUnion(userId),
    });
  });
  try {
    await batch.commit();
  } catch (error) {
    const permissionError = new FirestorePermissionError({
      path: `groups/${resolvedGroupId}/messages/[multiple]`,
      operation: 'update',
      requestResourceData: { readBy: `arrayUnion(${userId})` },
    });
    errorEmitter.emit('permission-error', permissionError);
    throw error;
  }
}

// --- Report & Archive Data Functions ---
export async function getAllExpensesForReport(): Promise<Expense[]> {
  const resolvedGroupId = resolveGroupId();
  const expensesCol = groupCollection(resolvedGroupId, 'expenses');
  const q = query(expensesCol, orderBy('date', 'asc'));
  try {
    const expenseSnapshot = await getDocs(q);
    return expenseSnapshot.docs.map((entry) => {
      const data = entry.data();
      return {
        id: entry.id,
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
  const resolvedGroupId = resolveGroupId();
  const contributionsCol = groupCollection(resolvedGroupId, 'contributions');
  const q = query(contributionsCol, orderBy('date', 'asc'));
  try {
    const contributionSnapshot = await getDocs(q);
    return contributionSnapshot.docs.map((entry) => {
      const data = entry.data();
      return {
        id: entry.id,
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
  const resolvedGroupId = resolveGroupId();
  const messagesCol = groupCollection(resolvedGroupId, 'messages');
  const q = query(messagesCol, orderBy('timestamp', 'asc'));
  try {
    const snapshot = await getDocs(q);
    return snapshot.docs.map((entry) => {
      const data = entry.data();
      return {
        id: entry.id,
        ...data,
        timestamp: (data.timestamp as Timestamp).toDate().toISOString(),
        readBy: (data.readBy as string[]) || [],
      } as ChatMessage;
    });
  } catch (error) {
    const permissionError = new FirestorePermissionError({ path: messagesCol.path, operation: 'list' });
    errorEmitter.emit('permission-error', permissionError);
    throw error;
  }
}

export async function clearAllData(): Promise<void> {
  const resolvedGroupId = resolveGroupId();
  const collectionsToClear = ['expenses', 'contributions', 'messages'];
  const batch = writeBatch(db);

  try {
    for (const collectionName of collectionsToClear) {
      const snapshot = await getDocs(groupCollection(resolvedGroupId, collectionName));
      snapshot.docs.forEach((entry) => {
        batch.delete(entry.ref);
      });
    }
    await batch.commit();
  } catch (error) {
    const permissionError = new FirestorePermissionError({
      path: `groups/${resolvedGroupId}/[${collectionsToClear.join(', ')}]`,
      operation: 'delete',
    });
    errorEmitter.emit('permission-error', permissionError);
    throw error;
  }
}

export async function getMonthArchives(): Promise<MonthArchiveSummary[]> {
  const resolvedGroupId = resolveGroupId();
  const archivesCol = groupCollection(resolvedGroupId, 'monthArchives');
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

export async function getMonthArchiveById(archiveId: string): Promise<MonthArchive | null> {
  const resolvedGroupId = resolveGroupId();
  const archiveRef = doc(db, 'groups', resolvedGroupId, 'monthArchives', archiveId);
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

  const resolvedGroupId = resolveGroupId(appConfig?.groupId);
  const now = new Date();
  const nowIso = now.toISOString();
  const periodStart = appConfig?.currentPeriodStart || appConfig?.createdAt || nowIso;
  const periodStartDate = new Date(periodStart);
  const periodLabel = Number.isNaN(periodStartDate.getTime())
    ? `Period ending ${now.toLocaleDateString()}`
    : `${periodStartDate.toLocaleString('en-US', { month: 'short' })} ${periodStartDate.getFullYear()}`;

  const archiveRef = doc(groupCollection(resolvedGroupId, 'monthArchives'));
  const archivesData = {
    groupId: appConfig?.groupId || resolvedGroupId,
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

  const appConfigRef = groupConfigDoc(resolvedGroupId, 'app');
  const collectionsToClear = ['expenses', 'contributions', 'messages'];
  const batch = writeBatch(db);
  batch.set(archiveRef, archivesData);

  const retentionCutoff = new Date(
    now.getTime() - ARCHIVE_RETENTION_DAYS * 24 * 60 * 60 * 1000,
  );
  const oldArchivesQuery = query(
    groupCollection(resolvedGroupId, 'monthArchives'),
    where('archivedAt', '<', Timestamp.fromDate(retentionCutoff)),
  );
  const oldArchivesSnapshot = await getDocs(oldArchivesQuery);
  oldArchivesSnapshot.docs.forEach((entry) => {
    batch.delete(entry.ref);
  });

  if (appConfig?.initialized) {
    batch.update(appConfigRef, {
      currentPeriodStart: nowIso,
      updatedAt: nowIso,
    });

    batch.update(groupRootDoc(resolvedGroupId), {
      updatedAt: nowIso,
    });
  }

  for (const collectionName of collectionsToClear) {
    const snapshot = await getDocs(groupCollection(resolvedGroupId, collectionName));
    snapshot.docs.forEach((entry) => {
      batch.delete(entry.ref);
    });
  }

  try {
    await batch.commit();
    return {
      id: archiveRef.id,
      groupId: appConfig?.groupId || resolvedGroupId,
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
      path: `groups/${resolvedGroupId}/monthArchives + config/app + live collections`,
      operation: 'create',
    });
    errorEmitter.emit('permission-error', permissionError);
    throw error;
  }
}
