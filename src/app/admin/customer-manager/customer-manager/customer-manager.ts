import { AsyncPipe, CommonModule, DatePipe, NgFor, NgIf } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { toObservable } from '@angular/core/rxjs-interop';
import { combineLatest, map, startWith } from 'rxjs';
import { AdminDataService, AdminOrder } from '../../admin-data.service';

type SortField = 'customerName' | 'restaurantName' | 'orderCount' | 'lastOrderDate';

interface AdminCustomer {
  id: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  restaurantName: string;
  shippingAddress?: string;
  orderCount: number;
  orderIds: string[];
  lastOrderDate?: Date;
}

interface CustomerAccumulator extends AdminCustomer {
  lastOrderDate?: Date;
}

@Component({
  selector: 'app-customer-manager',
  standalone: true,
  imports: [CommonModule, AsyncPipe, NgIf, NgFor, ReactiveFormsModule, DatePipe],
  templateUrl: './customer-manager.html',
  styleUrls: ['./customer-manager.scss'],
})
export class CustomerManagerComponent {
  private readonly adminDataService = inject(AdminDataService);
  private readonly fb = inject(FormBuilder);

  readonly customers$ = this.adminDataService.orders$.pipe(
    map((orders) => this.aggregateCustomers(orders))
  );

  readonly searchControl = this.fb.nonNullable.control('');
  readonly sortDirection = signal<'asc' | 'desc'>('asc');
  readonly sortField = signal<SortField>('customerName');

  readonly viewModel$ = combineLatest([
    this.customers$,
    this.searchControl.valueChanges.pipe(startWith('')),
    toObservable(this.sortDirection),
    toObservable(this.sortField),
  ]).pipe(
    map(([customers, searchTerm, direction, field]) => {
      const normalized = searchTerm.trim().toLocaleLowerCase();
      const filtered = normalized
        ? customers.filter((customer) => this.matchesSearch(customer, normalized))
        : customers;

      const sorted = [...filtered].sort((a, b) => this.compareCustomers(a, b, direction, field));
      return {
        customers: sorted,
        total: customers.length,
        filteredCount: sorted.length,
        hasSearch: normalized.length > 0,
      };
    })
  );

  readonly selectedCustomer = signal<AdminCustomer | null>(null);
  readonly editingCustomer = signal<AdminCustomer | null>(null);
  readonly feedback = signal('');
  readonly error = signal('');
  readonly processing = signal(false);

  readonly editForm = this.fb.nonNullable.group({
    customerName: [''],
    restaurantName: [''],
    customerEmail: [''],
    customerPhone: [''],
    shippingAddress: [''],
  });

  toggleSortDirection() {
    this.sortDirection.update((dir) => (dir === 'asc' ? 'desc' : 'asc'));
  }

  setSortField(field: SortField) {
    this.sortField.set(field);
  }

  selectCustomer(customer: AdminCustomer) {
    this.selectedCustomer.set(customer);
  }

  closeModal() {
    this.selectedCustomer.set(null);
  }

  startEdit(customer: AdminCustomer) {
    this.editingCustomer.set(customer);
    this.editForm.setValue({
      customerName: customer.customerName ?? '',
      restaurantName: customer.restaurantName ?? '',
      customerEmail: customer.customerEmail ?? '',
      customerPhone: customer.customerPhone ?? '',
      shippingAddress: customer.shippingAddress ?? '',
    });
  }

  cancelEdit() {
    this.editingCustomer.set(null);
    this.editForm.reset({
      customerName: '',
      restaurantName: '',
      customerEmail: '',
      customerPhone: '',
      shippingAddress: '',
    });
  }

  async saveEdit() {
    const customer = this.editingCustomer();

    if (!customer) {
      return;
    }

    const raw = this.editForm.getRawValue();
    const trimmed = {
      customerName: raw.customerName.trim(),
      restaurantName: raw.restaurantName.trim(),
      customerEmail: raw.customerEmail.trim(),
      customerPhone: raw.customerPhone.trim(),
      shippingAddress: raw.shippingAddress.trim(),
    };

    const changes = {
      customerName: trimmed.customerName || undefined,
      restaurantName: trimmed.restaurantName || undefined,
      customerEmail: trimmed.customerEmail || undefined,
      customerPhone: trimmed.customerPhone || undefined,
      shippingAddress: trimmed.shippingAddress || undefined,
    };

    this.processing.set(true);
    try {
      await this.adminDataService.updateCustomerOrders(customer.orderIds, changes);
      this.feedback.set('تم تحديث بيانات الزبون بنجاح.');
      this.error.set('');
      this.cancelEdit();
    } catch (err: any) {
      this.error.set(err?.message ?? 'تعذر تحديث بيانات الزبون.');
    } finally {
      this.processing.set(false);
    }
  }

  async deleteCustomer(customer: AdminCustomer) {
    if (!customer.orderIds.length) {
      return;
    }

    if (typeof window !== 'undefined') {
      const confirmed = window.confirm('هل أنت متأكد من حذف جميع طلبات هذا الزبون؟');
      if (!confirmed) {
        return;
      }
    }

    this.processing.set(true);
    try {
      await this.adminDataService.deleteCustomerOrders(customer.orderIds);
      this.feedback.set('تم حذف الزبون وجميع طلباته.');
      this.error.set('');
      if (this.selectedCustomer()?.id === customer.id) {
        this.closeModal();
      }
      if (this.editingCustomer()?.id === customer.id) {
        this.cancelEdit();
      }
    } catch (err: any) {
      this.error.set(err?.message ?? 'تعذر حذف الزبون.');
    } finally {
      this.processing.set(false);
    }
  }

  trackByCustomer(_index: number, customer: AdminCustomer): string {
    return customer.id;
  }

  private aggregateCustomers(orders: AdminOrder[]): AdminCustomer[] {
    const groups = new Map<string, CustomerAccumulator>();

    for (const order of orders) {
      const rawName = order.customerName?.trim() ?? '';
      const name = rawName || 'عميل غير معروف';
      const restaurant = this.extractRestaurantName(order);
      const key = `${restaurant.toLocaleLowerCase()}|${name.toLocaleLowerCase()}`;
      const createdAt = this.toDate(order.createdAt);
      const phone = this.extractPhone(order);
      const email = order.customerEmail?.trim();
      const address = order.shippingAddress?.trim();

      let group = groups.get(key);

      if (!group) {
        group = {
          id: key,
          customerName: name,
          restaurantName: restaurant,
          orderCount: 0,
          orderIds: [],
          customerEmail: email,
          customerPhone: phone,
          shippingAddress: address,
          lastOrderDate: createdAt,
        };
        groups.set(key, group);
      }

      group.orderCount += 1;

      if (order.id) {
        group.orderIds.push(order.id);
      }

      if (!group.customerName || group.customerName === 'عميل غير معروف') {
        group.customerName = name;
      }

      if (!group.restaurantName || group.restaurantName === 'غير محدد') {
        group.restaurantName = restaurant;
      }

      if (!group.lastOrderDate || createdAt > group.lastOrderDate) {
        group.lastOrderDate = createdAt;
        if (email) {
          group.customerEmail = email;
        }
        if (phone) {
          group.customerPhone = phone;
        }
        if (address) {
          group.shippingAddress = address;
        }
      } else {
        if (email && !group.customerEmail) {
          group.customerEmail = email;
        }
        if (phone && !group.customerPhone) {
          group.customerPhone = phone;
        }
        if (address && !group.shippingAddress) {
          group.shippingAddress = address;
        }
      }
    }
    return Array.from(groups.values()).map((group) => ({
      ...group,
      customerEmail: group.customerEmail,
      customerPhone: group.customerPhone,
      shippingAddress: group.shippingAddress,
    }));
  }

  private matchesSearch(customer: AdminCustomer, searchTerm: string): boolean {
    const haystacks = [
      customer.customerName,
      customer.restaurantName,
      customer.customerEmail ?? '',
      customer.customerPhone ?? '',
      customer.shippingAddress ?? '',
      String(customer.orderCount ?? ''),
    ].map((value) => value.toLocaleLowerCase());

    return haystacks.some((value) => value.includes(searchTerm));
  }

  private compareCustomers(
    a: AdminCustomer,
    b: AdminCustomer,
    direction: 'asc' | 'desc',
    field: SortField
  ): number {
    const multiplier = direction === 'asc' ? 1 : -1;
    let comparison = 0;

    switch (field) {
      case 'restaurantName':
        comparison = a.restaurantName.localeCompare(b.restaurantName, 'ar');
        break;
      case 'orderCount':
        comparison = a.orderCount - b.orderCount;
        break;
      case 'lastOrderDate':
        comparison = (a.lastOrderDate?.getTime() ?? 0) - (b.lastOrderDate?.getTime() ?? 0);
        break;
      case 'customerName':
      default:
        comparison = a.customerName.localeCompare(b.customerName, 'ar');
        break;
    }
    if (comparison === 0) {
      comparison = a.customerName.localeCompare(b.customerName, 'ar');
    }

    return comparison * multiplier;
  }

  private extractRestaurantName(order: AdminOrder): string {
    const direct = order.restaurantName?.trim();
    if (direct) {
      return direct;
    }

    const notes = order.notes ?? '';
    const match = /(?:اسم\s+المطعم|restaurant)\s*[:：]\s*(.+)/i.exec(notes);
    if (match?.[1]) {
      return match[1].split(/\r?\n/)[0].trim();
    }

    return 'غير محدد';
  }

  private extractPhone(order: AdminOrder): string | undefined {
    const direct = order.customerPhone?.trim();
    if (direct) {
      return direct;
    }

    const notes = order.notes ?? '';
    const match = /(?:هاتف|جوال|phone|tel)\s*[:：]?\s*([+\d][\d\s\-]{7,})/i.exec(notes);
    return match?.[1]?.trim();
  }

  private toDate(value: unknown): Date {
    if (!value) {
      return new Date(0);
    }

    const maybeTimestamp = value as { toDate?: () => Date };
    if (typeof maybeTimestamp?.toDate === 'function') {
      return maybeTimestamp.toDate();
    }

    const parsed = new Date(value as string | number | Date);
    return Number.isNaN(parsed.getTime()) ? new Date(0) : parsed;
  }
}
