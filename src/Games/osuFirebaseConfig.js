// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDkVmwJITjDRJ2IoV-NlXJRlthHukQaq-E",
  authDomain: "osu-name.firebaseapp.com",
  projectId: "osu-name",
  storageBucket: "osu-name.firebasestorage.app",
  messagingSenderId: "528661131656",
  appId: "1:528661131656:web:b8dfd23856b2acb59dca3d",
  measurementId: "G-NCBD8DM8W8"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);