import { waitForAsync, ComponentFixture, TestBed } from '@angular/core/testing';

import { MainAdminComponent } from './main-admin.component';

describe('MainAdminComponent', () => {
  let component: MainAdminComponent;
  let fixture: ComponentFixture<MainAdminComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [MainAdminComponent],
      imports: [],
    });
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(MainAdminComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should compile', () => {
    expect(component).toBeTruthy();
  });
});
