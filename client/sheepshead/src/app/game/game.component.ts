import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../environments/environment';

interface Room {
    id: string;
    name: string;
    game: string;
    options: Record<string, unknown>;
}

@Component({
    selector: 'app-game',
    templateUrl: './game.component.html',
    styleUrl: './game.component.css',
})
export class GameComponent implements OnInit {
    private readonly route = inject(ActivatedRoute);
    private readonly router = inject(Router);
    private readonly destroyRef = inject(DestroyRef);

    protected readonly game = signal('');
    protected readonly room = signal<Room | null>(null);
    protected readonly socketState = signal<'connecting' | 'open' | 'closed' | 'error'>('connecting');

    private socket: Socket | null = null;

    ngOnInit(): void {
        this.game.set(this.route.snapshot.paramMap.get('game') ?? '');
        this.room.set(history.state.room ?? null);
        this.openSocket();

        this.destroyRef.onDestroy(() => {
                this.socket?.disconnect();
        });
    }

    protected isSheepshead(): boolean {
        return this.game().toLowerCase() === 'sheepshead';
    }

    protected leaveGame(): void {
        this.router.navigateByUrl('/');
    }

    protected optionEntries(): [string, unknown][] {
        return Object.entries(this.room()?.options ?? {});
    }

    private openSocket(): void {
        this.socket = io(environment.apiUrl, {
            path: '/wss',
            transports: ['websocket'],
        });
        this.socket.on('connect', () => this.socketState.set('open'));
        this.socket.on('disconnect', () => this.socketState.set('closed'));
        this.socket.on('connect_error', () => this.socketState.set('error'));
    }
}
