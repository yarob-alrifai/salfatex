import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FloatingCartButton } from './floating-cart-button';

describe('FloatingCartButton', () => {
  let component: FloatingCartButton;
  let fixture: ComponentFixture<FloatingCartButton>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FloatingCartButton]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FloatingCartButton);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
