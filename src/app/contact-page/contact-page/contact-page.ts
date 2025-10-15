import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { ContactService } from 'src/app/services/contact.service';

@Component({
  selector: 'app-contact-page',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './contact-page.html',
  styleUrls: ['./contact-page.scss'],
})
export class ContactPageComponent {
  private readonly contactService = inject(ContactService);

  readonly contactInfo$ = this.contactService.getContactInfo();
}
