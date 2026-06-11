import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import {
  getDatabase,
  ref,
  set,
  get
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyAGZD3jwqGGeQyNQ3fuKWLML01jjfut94c",
  authDomain: "spinwheel-41d0b.firebaseapp.com",
  databaseURL: "https://spinwheel-41d0b-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "spinwheel-41d0b",
  storageBucket: "spinwheel-41d0b.firebasestorage.app",
  messagingSenderId: "1037626892232",
  appId: "1:1037626892232:web:74af568282279185d16afd"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

window.firebaseDB = db;

window.saveToFirebase = async function(data){
    try{
        console.log("Firebase write start");

        await set(ref(db, "spinwheel"), data);

        console.log("Firebase write success");
    }
    catch(err){
        console.error("Firebase write failed", err);
    }
};

window.loadFromFirebase = async function(){
    const snapshot = await get(ref(db, "spinwheel"));
    return snapshot.exists() ? snapshot.val() : null;
};

console.log("Firebase Connected");