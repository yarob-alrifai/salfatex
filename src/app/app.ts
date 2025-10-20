import { Component, signal, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import {
  Auth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from '@angular/fire/auth';
import { Firestore, collection, addDoc, getDocs } from '@angular/fire/firestore';
import { Storage, ref, uploadString, getDownloadURL } from '@angular/fire/storage';
// import { CartWidgetComponent } from './component/cart-widget/cart-widget';
import { FloatingCartButtonComponent } from './component/floating-cart-button/floating-cart-button';
import { NgClass, NgIf } from '@angular/common';

@Component({
  selector: 'app-root',
  standalone: true, // add if using standalone
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    // CartWidgetComponent,
    FloatingCartButtonComponent,
    NgIf,
    NgClass,
  ],
  templateUrl: './app.html',
  styleUrls: ['./app.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App implements OnInit {
  protected readonly title = signal('salfatex');
  protected readonly currentYear = new Date().getFullYear();
  protected readonly isMenuOpen = signal(false);

  constructor(private firestore: Firestore, private auth: Auth, private storage: Storage) {}

  async ngOnInit() {
    // try {
    //   try {
    //     const user = await createUserWithEmailAndPassword(
    //       this.auth,
    //       'test@example.com',
    //       'password123'
    //     );
    //     console.log('✅ User created:', user.user.uid);
    //   } catch (err: any) {
    //     if (err.code === 'auth/email-already-in-use') {
    //       const login = await signInWithEmailAndPassword(
    //         this.auth,
    //         'test@example.com',
    //         'password123'
    //       );
    //       console.log('✅ Logged in as existing user:', login.user.email);
    //     } else {
    //       throw err;
    //     }
    //   }
    //   // Test Firestore + Storage after login
    //   await this.testFirestore();
    //   await this.testStorage();
    // } catch (err) {
    //   console.error('❌ Auth test failed:', err);
    // }
  }

  async testFirestore() {
    try {
      const ref = await addDoc(collection(this.firestore, 'items'), {
        name: 'Test Item',
        createdAt: new Date(),
        user: this.auth.currentUser?.uid || 'anonymous',
      });
      console.log('✅ Firestore document written with ID:', ref.id);
      const snapshot = await getDocs(collection(this.firestore, 'items'));
      snapshot.forEach((doc) => console.log('📄 Firestore doc:', doc.id, doc.data()));
    } catch (err) {
      console.error('❌ Firestore test failed:', err);
    }
  }

  async testStorage() {
    try {
      const storageRef = ref(this.storage, 'uploads/test.txt');
      await uploadString(storageRef, 'Hello Firebases Emulator!');
      console.log('✅ File uploaded');

      const url = await getDownloadURL(storageRef);
      console.log('📂 File URL:', url);
    } catch (err) {
      console.error('❌ Storage test failed:', err);
    }
  }
  protected toggleMenu(): void {
    this.isMenuOpen.update((open) => !open);
  }

  protected closeMenu(): void {
    this.isMenuOpen.set(false);
  }
}
