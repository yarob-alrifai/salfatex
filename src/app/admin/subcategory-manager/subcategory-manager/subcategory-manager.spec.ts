import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SubcategoryManager } from './subcategory-manager';

describe('SubcategoryManager', () => {
  let component: SubcategoryManager;
  let fixture: ComponentFixture<SubcategoryManager>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SubcategoryManager]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SubcategoryManager);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
