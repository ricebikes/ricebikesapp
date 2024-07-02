import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AddRepairComponent } from './add-repair.component';

describe('AddRepairComponent', () => {
  let component: AddRepairComponent;
  let fixture: ComponentFixture<AddRepairComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddRepairComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AddRepairComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
