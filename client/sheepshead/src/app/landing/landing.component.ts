import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { environment } from '../../environments/environment';

interface User {
  id: string;
  name: string;
  email: string;
  picture: string | null;
  room: string | null;
}

interface Room {
  id: string;
  name: string;
  [key: string]: unknown;
}

type NoPickOption = 'leaster' | 'doubler' | 'none';
type PartnerOption = 'jackdiamonds' | 'callace' | 'none';

@Component({
  selector: 'app-landing',
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.css',
})

export class LandingComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);

  protected readonly users = signal<User[]>([]);
  protected readonly rooms = signal<Room[]>([]);
  protected readonly userSearchTerm = signal('');
  protected readonly roomSearchTerm = signal('');
  protected readonly usersLoading = signal(true);
  protected readonly roomsLoading = signal(true);
  protected readonly usersLoadError = signal(false);
  protected readonly roomsLoadError = signal(false);
  protected readonly lastUpdated = signal(new Date());

  protected readonly roomName = signal('');
  protected readonly gameName = signal('Sheepshead');
  protected readonly playerCount = signal<3 | 5>(5);
  protected readonly crackRecrack = signal(false);
  protected readonly doubleBump = signal(false);
  protected readonly noPick = signal<NoPickOption>('leaster');
  protected readonly partner = signal<PartnerOption>('jackdiamonds');
  protected readonly isCreateRoomDialogOpen = signal(false);

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

  protected openCreateRoomDialog(): void {
    this.resetCreateRoomForm();
    this.isCreateRoomDialogOpen.set(true);
  }

  protected closeCreateRoomDialog(): void {
    this.isCreateRoomDialogOpen.set(false);
    this.resetCreateRoomForm();
  }

  protected cancelCreateRoom(): void {
    this.closeCreateRoomDialog();
    this.router.navigateByUrl('/');
  }

  protected updatePlayerCount(value: string): void {
    const nextValue = Number(value) as 3 | 5;
    this.playerCount.set(nextValue);

    if (nextValue === 3) {
      this.partner.set('none');
    }
  }

  protected createRoom(): void {
    const roomName = this.roomName().trim();

    if (!/^[A-Za-z0-9][A-Za-z0-9\s-]*$/.test(roomName)) {
      window.alert('Room name must be alphanumeric.');
      return;
    }

    const payload = {
      name: roomName,
      game: 'sheepshead',
      options: {
        players: this.playerCount(),
        'crack-recrack': this.crackRecrack(),
        'double-bump': this.doubleBump(),
        'no-pick': this.noPick(),
        partner: this.playerCount() === 5 ? this.partner() : 'none',
      },
    };

    const headers = this.getHeaders();

    this.http.post(`${environment.apiUrl}/api/v1/rooms`, payload, { headers }).subscribe({
      next: () => {
        this.closeCreateRoomDialog();
        this.refreshData();
      },
      error: () => {
        window.alert('Room could not be created right now.');
      },
    });
  }

  private resetCreateRoomForm(): void {
    this.roomName.set('');
    this.gameName.set('Sheepshead');
    this.playerCount.set(5);
    this.crackRecrack.set(false);
    this.doubleBump.set(false);
    this.noPick.set('leaster');
    this.partner.set('jackdiamonds');
  }

  private getHeaders(): HttpHeaders | undefined {
    const token = sessionStorage.getItem('authToken');
    return token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : undefined;
  }

  private loadUsers(): void {
    const headers = this.getHeaders();

    this.http
      .get<User[] | { users: User[] }>(`${environment.apiUrl}/api/v1/users`, { headers })
      .subscribe({
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

    this.http
      .get<Room[] | { rooms: Room[] }>(`${environment.apiUrl}/api/v1/rooms`, { headers })
      .subscribe({
        next: (response) => {
          this.rooms.set(Array.isArray(response) ? response : response.rooms ?? []);
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
