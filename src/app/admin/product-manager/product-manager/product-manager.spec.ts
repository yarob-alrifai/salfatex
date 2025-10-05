import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProductManager } from './product-manager';

describe('ProductManager', () => {
  let component: ProductManager;
  let fixture: ComponentFixture<ProductManager>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProductManager]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ProductManager);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
