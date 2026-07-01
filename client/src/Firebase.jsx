// // Import the functions you need from the SDKs you need
// import { initializeApp } from "firebase/app";
// import { getAnalytics } from "firebase/analytics";
// // TODO: Add SDKs for Firebase products that you want to use
// // https://firebase.google.com/docs/web/setup#available-libraries

// // Your web app's Firebase configuration
// // For Firebase JS SDK v7.20.0 and later, measurementId is optional
// const firebaseConfig = {
//   apiKey: "AIzaSyAImHNkhaLaWykYR9vJPzzX_7GJpjc9Fdg",
//   authDomain: "dunnes-smart-trolley.firebaseapp.com",
//   projectId: "dunnes-smart-trolley",
//   storageBucket: "dunnes-smart-trolley.firebasestorage.app",
//   messagingSenderId: "997152074108",
//   appId: "1:997152074108:web:03d74cd7bd760d48ee9cf9",
//   measurementId: "G-Q7HN4EZJ02"
// };

// // Initialize Firebase
// const app = initializeApp(firebaseConfig);
// const analytics = getAnalytics(app);


// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAImHNkhaLaWykYR9vJPzzX_7GJpjc9Fdg",
  authDomain: "dunnes-smart-trolley.firebaseapp.com",
  projectId: "dunnes-smart-trolley",
  storageBucket: "dunnes-smart-trolley.firebasestorage.app",
  messagingSenderId: "997152074108",
  appId: "1:997152074108:web:03d74cd7bd760d48ee9cf9",
  measurementId: "G-Q7HN4EZJ02"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export Authentication and Firestore to use in our React components
export const auth = getAuth(app);
export const db = getFirestore(app);