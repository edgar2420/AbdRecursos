import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastContainerComponent } from './shared/components/ui.components';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, ToastContainerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <router-outlet></router-outlet>
    <app-toasts></app-toasts>
  `,
})
export class AppComponent {}
