import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Component, computed, inject, OnInit, signal } from '@angular/core';

interface User {
  id: string;
  name: string;
  email: string;
}

@Component({
  selector: 'app-landing',
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.css',
})
export class LandingComponent implements OnInit {
  private readonly http = inject(HttpClient);
  protected readonly users = signal<User[]>([]);
  protected readonly searchTerm = signal('');
  protected readonly isLoading = signal(true);
  protected readonly loadError = signal(false);
  protected readonly filteredUsers = computed(() => {
    const query = this.searchTerm().trim().toLowerCase();
    return this.users().filter((user) =>
      `${user.name} ${user.email}`.toLowerCase().includes(query),
    );
  });

  ngOnInit(): void {
    const token = sessionStorage.getItem('authToken');
    const headers = token
      ? new HttpHeaders({ Authorization: `Bearer ${token}` })
      : undefined;

    this.http.get<User[] | { users: User[] }>('http://localhost:8080/api/v1/users', { headers }).subscribe({
      next: (response) => {
        this.users.set(Array.isArray(response) ? response : response.users);
        this.isLoading.set(false);
      },
      error: () => {
        this.loadError.set(true);
        this.isLoading.set(false);
      },
    });
  }

  protected updateSearchTerm(value: string): void {
    this.searchTerm.set(value);
  }
}
