import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from 'firebase/auth'

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIIREBASE_APIKEY,
    authDomain: "interviewi-d711e.firebaseapp.com",
    projectId: "interviewi-d711e",
    storageBucket: "interviewi-d711e.firebasestorage.app",
    messagingSenderId: "242910929941",
    appId: "1:242910929941:web:2256a8af6667d2e8745a1c"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app)
const provider = new GoogleAuthProvider()

export { auth , provider }