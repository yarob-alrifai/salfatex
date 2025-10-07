import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SubcategoryDetail } from './subcategory-detail';

describe('SubcategoryDetail', () => {
  let component: SubcategoryDetail;
  let fixture: ComponentFixture<SubcategoryDetail>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SubcategoryDetail]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SubcategoryDetail);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
