import { AsyncPipe, CommonModule, CurrencyPipe, DatePipe, NgFor, NgIf } from '@angular/common';
import { Component, inject, computed, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { BehaviorSubject, combineLatest, map, startWith, tap } from 'rxjs';
import { AdminDataService, AdminOrder } from '../../admin-data.service';
import { ContactInfo, EMPTY_CONTACT_INFO } from '../../../models/contact-info.model';

@Component({
  selector: 'app-orders-dashboard',
  standalone: true,
  imports: [ReactiveFormsModule, NgIf, NgFor, AsyncPipe, DatePipe, CurrencyPipe, CommonModule],
  templateUrl: './orders-dashboard.html',
  styleUrls: ['./orders-dashboard.scss'],
})
export class OrdersDashboardComponent {
  private readonly fb = inject(FormBuilder);
  private readonly adminDataService = inject(AdminDataService);
  private readonly pageIndexSubject = new BehaviorSubject(0);
  readonly contactInfo = signal<ContactInfo>(EMPTY_CONTACT_INFO);

  readonly filterForm = this.fb.nonNullable.group({
    status: [''],
    startDate: [''],
    endDate: [''],
  });

  readonly editForm = this.fb.nonNullable.group({
    id: [''],
    status: [''],
    notes: [''],
    shippingAddress: [''],
  });

  readonly orders$ = this.adminDataService.orders$;
  readonly overallStats$ = this.orders$.pipe(
    map((orders) => ({
      count: orders.length,
      total: orders.reduce(
        (sum, order) => sum + (order.status === 'delivered' ? order.total ?? 0 : 0),
        0
      ),
    }))
  );

  readonly filteredOrders$ = combineLatest([
    this.orders$,
    this.filterForm.valueChanges.pipe(startWith(this.filterForm.getRawValue())),
  ]).pipe(
    map(([orders, filters]) => {
      return orders.filter((order) => {
        const statusMatches = filters.status ? order.status === filters.status : true;
        const createdAt = this.parseDate(order.createdAt);

        const startMatches = filters.startDate ? createdAt >= new Date(filters.startDate) : true;
        const endMatches = filters.endDate ? createdAt <= new Date(filters.endDate) : true;

        return statusMatches && startMatches && endMatches;
      });
    }),
    tap(() => this.pageIndexSubject.next(0))
  );

  readonly filteredStats$ = this.filteredOrders$.pipe(
    map((orders) => ({
      count: orders.length,
      total: orders.reduce(
        (sum, order) => sum + (order.status === 'delivered' ? order.total ?? 0 : 0),
        0
      ),
    }))
  );

  readonly statuses: AdminOrder['status'][] = [
    'pending',
    'confirmed',
    'shipped',
    'delivered',
    'cancelled',
  ];

  readonly feedback = signal('');
  readonly error = signal('');
  readonly editingOrderId = signal<string | null>(null);
  readonly selectedOrder = signal<AdminOrder | null>(null);
  readonly isModalOpen = computed(() => this.selectedOrder() !== null);
  readonly toDate = (value: unknown) => this.parseDate(value);
  readonly pageSize = 10;

  readonly statusStyles: Record<AdminOrder['status'], string> = {
    pending: 'bg-amber-100 text-amber-800 ring-1 ring-inset ring-amber-200',
    confirmed: 'bg-blue-100 text-blue-800 ring-1 ring-inset ring-blue-200',
    shipped: 'bg-indigo-100 text-indigo-800 ring-1 ring-inset ring-indigo-200',
    delivered: 'bg-emerald-100 text-emerald-800 ring-1 ring-inset ring-emerald-200',
    cancelled: 'bg-rose-100 text-rose-800 ring-1 ring-inset ring-rose-200',
  };

  readonly trackByOrder = (_: number, order: AdminOrder) =>
    order.id ?? order.orderNumber ?? String(_);
  readonly trackByItem = (_: number, item: AdminOrder['items'][number]) =>
    item.productId ?? item.name ?? String(_);
  readonly getOrderTotal = (order?: AdminOrder | null) => order?.total ?? 0;
  readonly paginatedOrders$ = combineLatest([
    this.filteredOrders$,
    this.pageIndexSubject.asObservable(),
  ]).pipe(
    map(([orders, pageIndex]) => {
      const total = orders.length;
      const totalPages = Math.ceil(total / this.pageSize);
      const safePageIndex = totalPages ? Math.min(Math.max(pageIndex, 0), totalPages - 1) : 0;
      const startIndex = total === 0 ? 0 : safePageIndex * this.pageSize + 1;
      const endIndex = total === 0 ? 0 : Math.min((safePageIndex + 1) * this.pageSize, total);

      return {
        items: orders.slice(
          safePageIndex * this.pageSize,
          safePageIndex * this.pageSize + this.pageSize
        ),
        total,
        totalPages,
        pageIndex: safePageIndex,
        startIndex,
        endIndex,
        pages: Array.from({ length: totalPages }, (_, i) => i),
      };
    })
  );

  constructor() {
    void this.loadContactInfo();
  }

  async confirmStatus(order: AdminOrder, status: AdminOrder['status']) {
    if (!order.id) {
      return;
    }

    await this.adminDataService.updateOrderStatus(order.id, status);
    this.feedback.set('تم تحديث حالة الطلب.');
    this.error.set('');
  }

  openOrderDetails(order: AdminOrder) {
    this.selectedOrder.set(order);
    this.editingOrderId.set(null);
    this.editForm.reset();
  }

  closeOrderDetails() {
    this.selectedOrder.set(null);
    this.cancelEdit();
  }

  editOrder(order: AdminOrder, event?: Event) {
    event?.stopPropagation();
    this.openOrderDetails(order);
    this.editingOrderId.set(order.id ?? null);
    this.editForm.patchValue({
      id: order.id ?? '',
      status: order.status,
      notes: order.notes ?? '',
      shippingAddress: order.shippingAddress ?? '',
    });
  }

  cancelEdit() {
    this.editingOrderId.set(null);
    this.editForm.reset();
  }

  async saveEdit() {
    if (!this.editForm.value.id) {
      return;
    }

    try {
      await this.adminDataService.updateOrder(this.editForm.value.id, {
        status: this.editForm.value.status as AdminOrder['status'],
        notes: this.editForm.value.notes ?? '',
        shippingAddress: this.editForm.value.shippingAddress ?? '',
      });
      this.feedback.set('تم تحديث الطلب.');
      this.error.set('');
      this.cancelEdit();
    } catch (err: any) {
      this.error.set(err?.message ?? 'تعذر تحديث الطلب.');
    }
  }

  async deleteOrder(order: AdminOrder, event?: Event) {
    event?.stopPropagation();
    if (!order.id) {
      return;
    }

    if (typeof window !== 'undefined' && !window.confirm('هل أنت متأكد من أنك تريد حذف العنصر؟')) {
      return;
    }

    await this.adminDataService.deleteOrder(order.id);
    this.feedback.set('تم حذف الطلب.');
    this.error.set('');
    this.closeOrderDetails();
  }

  private async loadContactInfo(): Promise<void> {
    try {
      const info = await this.adminDataService.getContactInfo();
      this.contactInfo.set(info);
    } catch (error) {
      console.error('Failed to load contact info for invoices', error);
    }
  }

  printOrder(order: AdminOrder, event?: Event) {
    event?.stopPropagation();
    if (!order || typeof window === 'undefined') {
      return;
    }

    const printWindow = window.open('', '_blank', 'width=900,height=620');
    if (!printWindow) {
      this.error.set('تعذر فتح نافذة الطباعة. يرجى السماح بالنوافذ المنبثقة والمحاولة مرة أخرى.');
      return;
    }

    const toNumber = (value: unknown) => {
      if (typeof value === 'number') {
        return Number.isFinite(value) ? value : 0;
      }

      const parsed = Number(value ?? 0);
      return Number.isFinite(parsed) ? parsed : 0;
    };

    const formatNumber = (
      value: unknown,
      minimumFractionDigits = 2,
      maximumFractionDigits = minimumFractionDigits
    ) =>
      new Intl.NumberFormat('ru-RU', {
        minimumFractionDigits,
        maximumFractionDigits,
      }).format(toNumber(value));

    const formatQuantity = (value: unknown) => {
      const numeric = toNumber(value);
      const digits = Number.isInteger(numeric) ? 0 : 3;
      return formatNumber(numeric, digits, digits);
    };

    const formatCurrency = (value: number | null | undefined) =>
      new Intl.NumberFormat('ru-RU', {
        style: 'currency',
        currency: 'SAR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(toNumber(value));

    const escapeHtml = (value: unknown) =>
      String(value ?? '—')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');

    const formatMultiline = (value: unknown) => escapeHtml(value).replace(/\n/g, '<br />');

    const createdAtDate = this.parseDate(order.createdAt);
    const formattedCreatedAt = createdAtDate.toLocaleString('ru-RU');
    const formattedInvoiceDate = createdAtDate.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
    const generatedAt = new Date().toLocaleString('ru-RU');

    const rawCustomerName = order.customerName?.trim() || 'Клиент без имени';
    const rawCustomerEmail = order.customerEmail?.trim() || '';
    const rawCustomerPhone = order.customerPhone?.trim() || '';
    const rawRestaurantName = order.restaurantName?.trim() || '';

    const orderNumber = escapeHtml(order.orderNumber ?? order.id ?? 'не указано');
    const status = escapeHtml(order.status ?? '—');
    const customerName = escapeHtml(rawCustomerName);
    const customerEmail = rawCustomerEmail ? escapeHtml(rawCustomerEmail) : '—';
    const customerPhone = rawCustomerPhone ? escapeHtml(rawCustomerPhone) : '—';
    const restaurantName = rawRestaurantName ? escapeHtml(rawRestaurantName) : '—';
    const shippingAddress = formatMultiline(order.shippingAddress ?? 'Адрес не указан');
    const notes = formatMultiline(order.notes ?? 'Примечания отсутствуют');

    const contactInfo = this.contactInfo();
    const trimmedAddress = contactInfo.address.trim();
    const supplierNameSource = trimmedAddress
      ? trimmedAddress.split('\n')[0]
      : 'Сальфатекс Трейдинг';
    const supplierName = escapeHtml(supplierNameSource);
    const supplierAddressBlock = trimmedAddress ? formatMultiline(trimmedAddress) : '—';
    const supplierPhone = contactInfo.phone.trim()
      ? `Тел.: ${escapeHtml(contactInfo.phone.trim())}`
      : '';
    const supplierMobile = contactInfo.mobile.trim()
      ? `Моб.: ${escapeHtml(contactInfo.mobile.trim())}`
      : '';
    const supplierEmail = contactInfo.email.trim()
      ? `E-mail: ${escapeHtml(contactInfo.email.trim())}`
      : '';

    const supplierDetails = [
      `<strong>${supplierName}</strong>`,
      supplierAddressBlock !== '—' ? supplierAddressBlock : '',
      supplierPhone,
      supplierMobile,
      supplierEmail,
    ]
      .filter((line) => Boolean(line))
      .join('<br />');

    const supplierDetailsBlock = supplierDetails || `<strong>${supplierName}</strong>`;

    const payerParts: string[] = [customerName];
    if (rawCustomerPhone) {
      payerParts.push(`Тел.: ${escapeHtml(rawCustomerPhone)}`);
    }
    if (rawCustomerEmail) {
      payerParts.push(`E-mail: ${escapeHtml(rawCustomerEmail)}`);
    }
    const payerDetails = payerParts.length ? payerParts.join('<br />') : '—';

    const consigneeParts: string[] = [];
    if (rawRestaurantName) {
      consigneeParts.push(escapeHtml(rawRestaurantName));
    } else {
      consigneeParts.push(customerName);
    }
    if (order.shippingAddress?.trim()) {
      consigneeParts.push(formatMultiline(order.shippingAddress.trim()));
    }
    const consigneeDetails = consigneeParts.length ? consigneeParts.join('<br />') : '—';

    const items = Array.isArray(order.items) ? order.items : [];
    const itemsRows = items.length
      ? items
          .map((item, index) => {
            const quantity = toNumber(item.quantity ?? 0);
            const pieces = toNumber(item.piecesCount ?? 0);
            const unit = item.unitLabel ?? item.unitType ?? '—';
            const unitPrice =
              item.unitPrice ??
              (quantity ? toNumber(item.price ?? 0) / quantity : toNumber(item.price ?? 0));
            const lineTotal = item.price ?? unitPrice * quantity;
            const piecesDisplay = pieces > 0 ? formatQuantity(pieces) : '—';

            return `
              <tr>
                <td class="text-center">${index + 1}</td>
                <td>
                  <div class="item-name">${escapeHtml(item.name ?? '—')}</div>
                  <div class="item-meta">Цвет: ${escapeHtml(item.color ?? '—')}</div>
                                    <div class="item-meta">Ткань: ${escapeHtml(
                                      item.fabric ?? '—'
                                    )}</div>

                </td>
                <td class="text-center">${escapeHtml(unit)}</td>
                <td class="text-center">${formatQuantity(quantity)}</td>
                <td class="text-center">${piecesDisplay}</td>
                <td class="text-right">${formatCurrency(unitPrice)}</td>
                <td class="text-right">${formatCurrency(lineTotal)}</td>
              </tr>
            `;
          })
          .join('')
      : `



   
          <tr>
                      <td colspan="7" class="empty-row">В этом заказе нет товаров.</td>

          </tr>
        `;

    const totalQuantity = items.reduce((sum, item) => sum + toNumber(item.quantity ?? 0), 0);
    const totalPieces = items.reduce((sum, item) => sum + toNumber(item.piecesCount ?? 0), 0);
    const total = this.getOrderTotal(order);
    const formattedTotal = formatCurrency(total);

    const summaryFooter = items.length
      ? `
          <tfoot>
            <tr>
              <td colspan="3" class="text-right">Итого:</td>
              <td class="text-center">${formatQuantity(totalQuantity)}</td>
              <td class="text-center">${totalPieces > 0 ? formatQuantity(totalPieces) : '—'}</td>
              <td class="text-right">—</td>
              <td class="text-right">${formattedTotal}</td>
            </tr>
            <tr>
              <td colspan="6" class="text-right">В том числе НДС</td>
              <td class="text-right">—</td>
            </tr>
          </tfoot>
        `
      : '';

    const summaryText = items.length
      ? `Всего наименований ${items.length}, на сумму ${formattedTotal}.`
      : 'В этом заказе нет товаров.';
    const amountInWords = items.length ? `К оплате: ${formattedTotal}` : '';
    const amountInWordsLine = amountInWords ? `<p>${amountInWords}</p>` : '';

    const bankName = supplierName;
    const placeholder = '—';
    const metaLine = `Статус заказа: ${status} · Дата заказа: ${formattedCreatedAt} · Дата печати: ${generatedAt}`;

    printWindow.document.open();
    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="ru">
        <head>
          <meta charset="utf-8" />
          <title>Печать заказа ${orderNumber}</title>
          <style>
           * {
              box-sizing: border-box;
            }
            body {
             
            

              margin: 0;
              font-family: 'PT Sans', 'Arial', sans-serif;

              color: #0f172a;

               background: #ffffff;
            }
            .invoice-wrapper {
              width: 210mm;
              margin: 0 auto;
              padding: 18mm 15mm;



            }
           .header-grid {
              display: grid;
              grid-template-columns: 1.3fr 1fr;
              gap: 16px;

              margin-bottom: 24px;
         
              

            }
           .header-box {
              border: 1px solid #1f2937;
              padding: 12px 14px;
              min-height: 120px;
              font-size: 12px;
              line-height: 1.5;


            }
           .header-box strong {
              font-size: 13px;


            }
           
            

             .bank-table {
              width: 100%;
              border-collapse: collapse;
              font-size: 12px;
            }
            .bank-table th,
            .bank-table td {
              border: 1px solid #1f2937;
              padding: 6px 8px;
              text-align: left;
              vertical-align: top;
            }
            .invoice-title {
              text-align: center;
              margin-bottom: 16px;
            }
            .invoice-title h1 {
              margin: 0;
              font-size: 22px;
              font-weight: 700;
              text-transform: uppercase;
            }
            .invoice-title p {
              margin: 6px 0 0;
              font-size: 12px;



              color: #475569;
            }
          
            

            .invoice-title .meta-line {
              margin-top: 8px;
              font-size: 11px;
              color: #334155;


            }
 .counterparties {
              width: 100%;
              border-collapse: collapse;              font-size: 12px;
                          margin-bottom: 18px;





            }
             .counterparties th,
            .counterparties td {
              border: 1px solid #1f2937;
              padding: 8px 10px;
              text-align: left;
            }
            .items-table {
              width: 100%;
              border-collapse: collapse;
              
              


               font-size: 12px;
              margin-bottom: 18px;
            }
            .items-table th,
            .items-table td {
              border: 1px solid #1f2937;
              padding: 8px 10px;
            }
            .items-table thead tr:first-child {
              background: #f3f4f6;
            }
            .items-table th {
              text-align: center;
              font-weight: 700;
            }
            .items-table td {
              vertical-align: top;





              
            }
              .items-table .text-center {
              text-align: center;






            }
          
            
                        .items-table .text-right {

              text-align: right;
            }
           
            


                        .items-table .item-name {


              font-weight: 600;
   margin-bottom: 4px;
            }
            .items-table .item-meta {
              font-size: 11px;
              color: #475569;
            }
            .items-table tfoot td {
              font-weight: 700;
              
              
              }
           .items-table .empty-row {
              text-align: center;
              color: #64748b;
            }
            .summary-block {



              font-size: 12px;
                margin-bottom: 18px;
              line-height: 1.6;
            }
            .summary-block p {
              margin: 4px 0;
            }
            .info-columns {
              display: grid;
              grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
              gap: 16px;
              margin-bottom: 24px;
            }
            .info-columns .info-box {
              border: 1px solid #1f2937;
              padding: 12px 14px;
              min-height: 110px;
              background: #fafafa;
              font-size: 12px;
              line-height: 1.6;
            }
            .info-columns h3 {
              margin: 0 0 8px;
              font-size: 13px;
              text-transform: uppercase;
            }
            .signature-block {
              margin-top: 24px;
              font-size: 12px;
            }
            .signature-line {
              display: flex;
              align-items: center;
              gap: 12px;
              margin-bottom: 12px;
            }
            .signature-line .line {
              flex: 1;
              height: 1px;
              background: #0f172a;
            }
            .signature-line .line-name {
              flex: 0 0 140px;
            }
            .footer-note {
              font-size: 11px;
              color: #64748b;
              text-align: right;
              margin-top: 24px;






            }
            @media print {
              body {
                         margin: 0;

              }
             .invoice-wrapper {
                padding: 12mm 10mm;
                width: auto;


              }
            }
          </style>
        </head>
        <body dir="ltr">
         
        





 <div class="invoice-wrapper">
            <div class="header-grid">
              <div class="header-box">
                ${supplierDetailsBlock}





              </div>
       
              






 <div class="header-box">
                <table class="bank-table">
                  <tr>
                    <th>Банк получателя</th>
                    <td>${bankName}</td>
                  </tr>
                  <tr>
                    <th>БИК</th>
                    <td>${placeholder}</td>
                  </tr>
                  <tr>
                    <th>Сч. №</th>
                    <td>${placeholder}</td>
                  </tr>
                  <tr>
                    <th>Получатель</th>
                    <td>${supplierName}</td>
                  </tr>
                  <tr>
                    <th>Сч. №</th>
                    <td>${placeholder}</td>
                  </tr>
                </table>




              </div>
            </div>
       

    
            
 <div class="invoice-title">
              <h1>Счет № ${orderNumber} от ${formattedInvoiceDate}</h1>
              <p>Образец заполнения платежного поручения</p>
              <p class="meta-line">${metaLine}</p>
            </div>

            <table class="counterparties">
              <tr>
                <th>Поставщик</th>
                <td>${supplierDetailsBlock}</td>
              </tr>
              <tr>
                <th>Плательщик</th>
                <td>${payerDetails}</td>
              </tr>
              <tr>
                <th>Заказчик</th>
                <td>${consigneeDetails}</td>
              </tr>
            </table>

            <table class="items-table">



              <thead>
                <tr>
                
                


 <th rowspan="2">№</th>
                  <th rowspan="2" class="col-name">Наименование товаров (описание выполненных работ, оказанных услуг)</th>
                  <th rowspan="2">Ед. изм.</th>
                  <th colspan="2">Количество</th>
                  <th rowspan="2">Цена, SAR</th>
                  <th rowspan="2">Сумма, SAR</th>
                </tr>
                <tr>
                  <th>Кол-во</th>
                  <th>Кол-во (шт.)</th>






                </tr>
              </thead>
              <tbody>
                ${itemsRows}
              </tbody>
                            ${summaryFooter}

            </table>
           <div class="summary-block">
              <p>${summaryText}</p>
              ${amountInWordsLine}
            </div>

        
            


 <div class="info-columns">
              <div class="info-box">
                <h3>Адрес доставки</h3>
                <p>${shippingAddress}</p>
              </div>
              <div class="info-box">
                <h3>Примечания</h3>
                <p>${notes}</p>
              </div>
            </div>





         
              <div class="signature-block">
              <div class="signature-line">
                <span>Руководитель предприятия</span>
                <div class="line"></div>
                <span>(Подпись)</span>
                <div class="line line-name"></div>
                <span>(ФИО)</span>
              </div>
              <div class="signature-line">
                <span>Главный бухгалтер</span>
                <div class="line"></div>
                <span>(Подпись)</span>
                <div class="line line-name"></div>
                <span>(ФИО)</span>
              </div>
            </div>





   <p class="footer-note">Документ сформирован автоматически. ${generatedAt}</p>
          </div>
                  </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();

    setTimeout(() => {
      try {
        printWindow.print();
      } finally {
        printWindow.close();
      }
    }, 300);
  }

  goToPage(index: number, totalPages: number) {
    if (!totalPages) {
      return;
    }

    const safeIndex = Math.max(0, Math.min(index, totalPages - 1));
    this.pageIndexSubject.next(safeIndex);
  }

  private parseDate(value: unknown): Date {
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
