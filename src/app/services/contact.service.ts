import { inject, Injectable } from '@angular/core';
import { Firestore, doc, docData } from '@angular/fire/firestore';
import { Observable, catchError, map, of } from 'rxjs';
import { ContactInfo, EMPTY_CONTACT_INFO } from '../models/contact-info.model';

@Injectable({
  providedIn: 'root',
})
export class ContactService {
  private readonly firestore = inject(Firestore, { optional: true });

  getContactInfo(): Observable<ContactInfo> {
    if (!this.firestore) {
      return of(EMPTY_CONTACT_INFO);
    }

    const reference = doc(this.firestore, 'settings', 'contact');

    return docData(reference).pipe(
      map((data) => this.normalizeContactInfo(data as Partial<ContactInfo> | undefined)),
      catchError(() => of(EMPTY_CONTACT_INFO))
    );
  }

  private normalizeContactInfo(data?: Partial<ContactInfo>): ContactInfo {
    return {
      phone: data?.phone?.trim() ?? '',
      mobile: data?.mobile?.trim() ?? '',
      email: data?.email?.trim() ?? '',
      address: data?.address?.trim() ?? '',
      whatsappUrl: data?.whatsappUrl?.trim() ?? '',
      telegramUrl: data?.telegramUrl?.trim() ?? '',
      whatsappQrUrl: data?.whatsappQrUrl?.trim() ?? '',
    };
  }
}
