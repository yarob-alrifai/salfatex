import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CustomerManager } from './customer-manager';

describe('CustomerManager', () => {
  let component: CustomerManager;
  let fixture: ComponentFixture<CustomerManager>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CustomerManager]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CustomerManager);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
