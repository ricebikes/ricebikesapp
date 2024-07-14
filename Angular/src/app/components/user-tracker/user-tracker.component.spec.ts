import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UserTrackerComponent } from './user-tracker.component';

describe('UserTrackerComponent', () => {
  let component: UserTrackerComponent;
  let fixture: ComponentFixture<UserTrackerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UserTrackerComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(UserTrackerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
