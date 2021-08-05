import {firebase} from "@firebase/app";
import "@firebase/storage";
import "@firebase/auth";
const app = firebase.initializeApp({
    apiKey: "AIzaSyC28NIuL_06bJDdK2454mRYN4d5fyqgn_k",
    authDomain: "readsyncpdf.firebaseapp.com",
    projectId: "readsyncpdf",
    storageBucket: "readsyncpdf.appspot.com",
    messagingSenderId: "1030733509987",
    appId: "1:1030733509987:web:869436f3e53258482b8f56",
    measurementId: "G-835RS0WS5S",
})

export const storage = firebase.storage();
export const firebaseRef = firebase;
export const auth = firebase.auth;

export default app;