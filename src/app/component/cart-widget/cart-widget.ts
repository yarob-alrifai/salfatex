// import { CommonModule } from '@angular/common';
// import { Component, Signal, computed, inject, signal } from '@angular/core';
// import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
// import { CurrencyPipe } from '@angular/common';
// import { CartService } from '../../services/cart.service';

// @Component({
//   selector: 'app-cart-widget',
//   standalone: true,
//   imports: [CommonModule, ReactiveFormsModule, CurrencyPipe],
//   templateUrl: './cart-widget.html',
//   styleUrls: ['./cart-widget.scss'],
// })
// export class CartWidgetComponent {
//   private readonly cartService = inject(CartService);
//   private readonly fb = inject(FormBuilder);

//   readonly isOpen = signal(false);
//   readonly submitting = signal(false);
//   readonly errorMessage = signal<string | null>(null);
//   readonly successMessage = signal<string | null>(null);

//   readonly items = this.cartService.items;
//   readonly total = this.cartService.total;
//   readonly itemCount = this.cartService.itemCount;

//   readonly checkoutForm = this.fb.nonNullable.group({
//     customerName: ['', [Validators.required, Validators.minLength(2)]],
//     customerEmail: ['', [Validators.email]],
//     shippingAddress: [''],
//     notes: [''],
//   });

//   readonly hasItems: Signal<boolean> = computed(() => this.items().length > 0);

//   toggle() {
//     this.isOpen.update((open) => !open);

//     if (!this.isOpen()) {
//       return;
//     }

//     this.errorMessage.set(null);
//     if (this.hasItems()) {
//       this.successMessage.set(null);
//     }
//   }

//   close() {
//     this.isOpen.set(false);
//   }

//   increment(productId: string) {
//     this.cartService.increment(productId);
//   }

//   decrement(productId: string) {
//     this.cartService.decrement(productId);
//   }

//   async submitOrder() {
//     if (this.checkoutForm.invalid) {
//       this.checkoutForm.markAllAsTouched();
//       return;
//     }

//     this.submitting.set(true);
//     this.errorMessage.set(null);

//     try {
//       const order = await this.cartService.submitOrder(this.checkoutForm.getRawValue());
//       const reference = order.orderNumber ?? order.id;
//       this.successMessage.set(
//         reference ? `تم استلام طلبك بنجاح! رقم الطلب: ${reference}` : 'تم استلام طلبك بنجاح!'
//       );
//       this.checkoutForm.reset();
//     } catch (error) {
//       const message = error instanceof Error ? error.message : 'تعذر إرسال الطلب. حاول مرة أخرى.';
//       this.errorMessage.set(message);
//     } finally {
//       this.submitting.set(false);
//     }
//   }
// }
