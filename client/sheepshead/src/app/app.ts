import { Component, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { LandingComponent } from './landing/landing.component';
import { LoginComponent } from './login/login.component';

@Component({
  imports: [RouterOutlet, LandingComponent, LoginComponent],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
  private readonly router = inject(Router);
  protected readonly isLoggedIn = signal(this.hasValidAuthToken());
  protected readonly isGamePage = signal(this.router.url.startsWith('/game/'));

  constructor() {
    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe((event) => {
        this.isGamePage.set(event.urlAfterRedirects.startsWith('/game/'));
      });
  }

  protected showLandingPage(_token: string): void {
    this.isLoggedIn.set(true);
  }

  private hasValidAuthToken(): boolean {
    const token = sessionStorage.getItem('authToken');
    if (!token) {
      return false;
    }

    try {
      const payload = token.split('.')[1];
      if (!payload) {
        return false;
      }

      const claims = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))) as {
        exp?: unknown;
      };

      return typeof claims.exp === 'number' && claims.exp > Date.now() / 1000;
    } catch {
      return false;
    }
  }
}
