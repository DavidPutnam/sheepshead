import { Component, AfterViewInit, NgZone, output } from '@angular/core';

declare var google: any;

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
})
export class LoginComponent implements AfterViewInit {
  readonly loginSuccessful = output<string>();

  constructor(private _ngZone: NgZone) {}   

  ngAfterViewInit(): void {
    if (typeof google === 'undefined') {
      return;
    }

    google.accounts.id.initialize({
      client_id: '298908306191-c9ng471f6tbh9nt1kiikkpr3n3rduueo.apps.googleusercontent.com',
      callback: this.handleCredentialResponse.bind(this),
    });

    const googleButton = document.getElementById('google-button');
    if (googleButton) {
      google.accounts.id.renderButton(googleButton, { theme: 'outline', size: 'large' });
    }
  }

  handleCredentialResponse(response: { credential: string }): void {
    this._ngZone.run(() => {
      sessionStorage.setItem('authToken', response.credential);
      this.loginSuccessful.emit(response.credential);
    });
  }
}