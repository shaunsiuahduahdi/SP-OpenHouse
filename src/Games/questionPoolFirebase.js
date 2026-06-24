// questionPoolFirebase.js — Loads question pools from Firebase
import { db } from './firebaseConfig';
import { collection, getDocs } from 'firebase/firestore';

export const QUESTION_POOL = {
  sp_focused_easy: [],
  sp_focused_hard: [],
  tech_focused_easy: [],
  tech_focused_hard: [],
  custom: [],
};

const CATEGORIES = ['sp_focused_easy','sp_focused_hard','tech_focused_easy','tech_focused_hard','custom'];

export async function loadQuestionPool() {
  console.log('[QuestionPool] Loading from Firebase...');
  let totalLoaded = 0;
  for (const category of CATEGORIES) {
    try {
      const querySnapshot = await getDocs(collection(db, 'question_pools', category, 'questions'));
      const questions = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.q && data.l && data.r && data.c) {
          questions.push({ q: data.q, l: data.l, r: data.r, c: data.c });
        }
      });
      QUESTION_POOL[category] = questions;
      totalLoaded += questions.length;
      console.log(`[QuestionPool] ${category}: ${questions.length} questions`);
    } catch (err) {
      console.warn(`[QuestionPool] Failed to load ${category}:`, err);
    }
  }
  console.log(`[QuestionPool] Total loaded: ${totalLoaded} questions`);
  return QUESTION_POOL;
}