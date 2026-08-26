/**
 * StudyData: 全画面共通のデータ層(Firestore経由)。
 * どの画面もdb/authに直接触らず、必ずこのAPIを経由すること。
 * (Firestoreスキーマを変えるときはここだけ直せば全画面に反映される)
 */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  getDocs,
  query,
  where,
  arrayUnion,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { firebaseConfig } from "./firebase-config.js";

const DEFAULT_SUBJECTS = ["数学", "英語", "国語", "理科", "社会"];
const DEFAULT_GOAL_MINUTES = 60;
const CURRENT_USER_KEY = "studyTrackerCurrentUser";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

let readyResolve;
const ready = new Promise((resolve) => {
  readyResolve = resolve;
});
onAuthStateChanged(auth, (user) => {
  if (user) readyResolve();
});
signInAnonymously(auth).catch((e) => {
  console.error("匿名ログインに失敗しました。firebase-config.jsの設定値を確認してください。", e);
});

function userDocRef(name) {
  return doc(db, "users", name);
}

function entryDocRef(name, date) {
  return doc(db, "users", name, "entries", date);
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

async function ensureUser(name) {
  const ref = userDocRef(name);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    return snap.data();
  }
  const initial = {
    role: null,
    teacherName: null,
    subjects: [...DEFAULT_SUBJECTS],
    goal: { dailyMinutes: DEFAULT_GOAL_MINUTES },
    createdAt: Date.now(),
  };
  await setDoc(ref, initial);
  return initial;
}

function getCurrentUser() {
  return localStorage.getItem(CURRENT_USER_KEY);
}

function logout() {
  localStorage.removeItem(CURRENT_USER_KEY);
}

async function loginAs(name) {
  await ensureUser(name);
  localStorage.setItem(CURRENT_USER_KEY, name);
}

async function getUserData(name) {
  const snap = await getDoc(userDocRef(name));
  return snap.exists() ? snap.data() : null;
}

async function setRole(name, role) {
  await updateDoc(userDocRef(name), { role });
}

async function listTeachers() {
  const q = query(collection(db, "users"), where("role", "==", "teacher"));
  const snaps = await getDocs(q);
  return snaps.docs.map((d) => d.id);
}

async function setTeacher(studentName, teacherName) {
  await updateDoc(userDocRef(studentName), { teacherName });
}

async function listStudentsOf(teacherName) {
  const q = query(collection(db, "users"), where("teacherName", "==", teacherName));
  const snaps = await getDocs(q);
  return snaps.docs.map((d) => d.id);
}

async function getSubjects(name) {
  const u = await getUserData(name);
  return u ? [...u.subjects] : [...DEFAULT_SUBJECTS];
}

async function setSubjects(name, subjects) {
  await updateDoc(userDocRef(name), { subjects: [...subjects] });
}

async function addSubject(name, subject) {
  await updateDoc(userDocRef(name), { subjects: arrayUnion(subject) });
}

async function removeSubject(name, subject) {
  const u = await getUserData(name);
  const subjects = (u.subjects || []).filter((s) => s !== subject);
  await updateDoc(userDocRef(name), { subjects });
}

async function getGoal(name) {
  const u = await getUserData(name);
  return u ? u.goal.dailyMinutes : DEFAULT_GOAL_MINUTES;
}

async function setGoal(name, minutes) {
  await updateDoc(userDocRef(name), { goal: { dailyMinutes: minutes } });
}

function emptyEntry(date) {
  return { date, records: [], studiedContent: "", issues: "", question: "", other: "" };
}

async function getEntry(name, date) {
  const snap = await getDoc(entryDocRef(name, date));
  return snap.exists() ? snap.data() : emptyEntry(date);
}

async function saveEntry(name, date, partial) {
  const current = await getEntry(name, date);
  await setDoc(entryDocRef(name, date), { ...current, ...partial, date });
}

async function addRecordToEntry(name, date, record) {
  const current = await getEntry(name, date);
  const records = [...(current.records || []), record];
  await saveEntry(name, date, { records });
}

async function updateRecordInEntry(name, date, index, record) {
  const current = await getEntry(name, date);
  const records = [...(current.records || [])];
  records[index] = record;
  await saveEntry(name, date, { records });
}

async function removeRecordFromEntry(name, date, index) {
  const current = await getEntry(name, date);
  const records = (current.records || []).filter((_, i) => i !== index);
  await saveEntry(name, date, { records });
}

async function listEntryDates(name) {
  const snaps = await getDocs(collection(db, "users", name, "entries"));
  return snaps.docs.map((d) => d.id).sort().reverse();
}

async function getAllEntries(name) {
  const snaps = await getDocs(collection(db, "users", name, "entries"));
  return snaps.docs.map((d) => d.data());
}

function getTotalMinutes(entries) {
  return entries.reduce(
    (sum, e) => sum + (e.records || []).reduce((s, r) => s + r.minutes, 0),
    0
  );
}

function getMinutesByDate(entries) {
  const map = {};
  entries.forEach((e) => {
    map[e.date] = (e.records || []).reduce((s, r) => s + r.minutes, 0);
  });
  return map;
}

function calcStreak(entries) {
  const byDate = getMinutesByDate(entries);
  let streak = 0;
  const cursor = new Date();
  if (!byDate[todayStr()]) {
    cursor.setDate(cursor.getDate() - 1);
  }
  while (true) {
    const key = cursor.toISOString().slice(0, 10);
    if (byDate[key]) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

export const StudyData = {
  ready,
  loginAs,
  getCurrentUser,
  logout,
  getUserData,
  setRole,
  listTeachers,
  setTeacher,
  listStudentsOf,
  getSubjects,
  setSubjects,
  addSubject,
  removeSubject,
  getGoal,
  setGoal,
  getEntry,
  saveEntry,
  addRecordToEntry,
  updateRecordInEntry,
  removeRecordFromEntry,
  listEntryDates,
  getAllEntries,
  getTotalMinutes,
  getMinutesByDate,
  calcStreak,
  todayStr,
  DEFAULT_SUBJECTS,
  DEFAULT_GOAL_MINUTES,
};
