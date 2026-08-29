import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { LandingComponent } from './landing/landing.component';
import { LoginComponent } from './login/login.component';

@Component({
  imports: [RouterOutlet, LandingComponent, LoginComponent],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
  protected readonly isLoggedIn = signal(false);

  protected showLandingPage(_token: string): void {
    this.isLoggedIn.set(true);
  }
}
