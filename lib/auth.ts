import { auth } from "@/lib/firebase/client"
import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User,
} from "firebase/auth"

const provider = new GoogleAuthProvider()
provider.setCustomParameters({ prompt: "select_account" })

export const signInWithGoogle = () => signInWithPopup(auth, provider)
export const signOutUser = () => signOut(auth)
export const onAuthChange = (callback: (user: User | null) => void) =>
  onAuthStateChanged(auth, callback)
