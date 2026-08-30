import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';

interface User {
  id: string;
  name: string;
  email: string;
}

interface Room {
  id: string;
  name: string;
  [key: string]: unknown;
}

@Component({
  selector: 'app-landing',
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.css',
})

export class LandingComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly users = signal<User[]>([]);
  protected readonly rooms = signal<Room[]>([]);
  protected readonly userSearchTerm = signal('');
  protected readonly roomSearchTerm = signal('');
  protected readonly usersLoading = signal(true);
  protected readonly roomsLoading = signal(true);
  protected readonly usersLoadError = signal(false);
  protected readonly roomsLoadError = signal(false);
  protected readonly lastUpdated = signal(new Date());

  private readonly refreshInterval = window.setInterval(() => {
    this.refreshData();
  }, 30000);

  protected readonly filteredUsers = computed(() => {
    const query = this.userSearchTerm().trim().toLowerCase();
    return this.users().filter((user) =>
      `${user.name} ${user.email}`.toLowerCase().includes(query),
    );
  });

  protected readonly filteredRooms = computed(() => {
    const query = this.roomSearchTerm().trim().toLowerCase();
    return this.rooms().filter((room) => {
      const searchableText = [
        room.name,
        room.id,
        ...Object.entries(room)
          .filter(([key]) => key !== 'id' && key !== 'name')
          .map(([, value]) => JSON.stringify(value)),
      ]
        .join(' ')
        .toLowerCase();

      return searchableText.includes(query);
    });
  });

  ngOnInit(): void {
    this.refreshData();
    this.destroyRef.onDestroy(() => {
      window.clearInterval(this.refreshInterval);
    });
  }

  protected refreshData(): void {
    this.loadUsers();
    this.loadRooms();
  }

  protected updateUserSearchTerm(value: string): void {
    this.userSearchTerm.set(value);
  }

  protected updateRoomSearchTerm(value: string): void {
    this.roomSearchTerm.set(value);
  }

  protected formattedLastUpdated(): string {
    return this.lastUpdated().toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
    });
  }

  private getHeaders(): HttpHeaders | undefined {
    const token = sessionStorage.getItem('authToken');
    return token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : undefined;
  }

  private loadUsers(): void {
    const headers = this.getHeaders();

    this.http.get<User[] | { users: User[] }>('${environment.apiBaseUrl}/api/v1/users', { headers }).subscribe({
      next: (response) => {
        this.users.set(Array.isArray(response) ? response : response.users ?? []);
        this.usersLoading.set(false);
        this.usersLoadError.set(false);
        this.lastUpdated.set(new Date());
      },
      error: () => {
        this.usersLoading.set(false);
        this.usersLoadError.set(true);
        this.lastUpdated.set(new Date());
      },
    });
  }

  private loadRooms(): void {
    const headers = this.getHeaders();

    this.http.get<Room[] | { rooms: Room[] }>('${environment.apiBaseUrl}/api/v1/rooms', { headers }).subscribe({
      next: (response) => {
        const rooms = Array.isArray(response) ? response : response.rooms ?? [];
        this.rooms.set(
          rooms.map((room, index) => ({
            ...room,
            id: String(room.id ?? room.name ?? `room-${index + 1}`),
            name: String(room.name ?? room.id ?? `Room ${index + 1}`),
          })),
        );
        this.roomsLoading.set(false);
        this.roomsLoadError.set(false);
        this.lastUpdated.set(new Date());
      },
      error: () => {
        this.roomsLoading.set(false);
        this.roomsLoadError.set(true);
        this.lastUpdated.set(new Date());
      },
    });
  }
}
