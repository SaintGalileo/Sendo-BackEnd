import { Server, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';

export class SocketService {
    private static instance: SocketService;
    private io: Server | null = null;

    private constructor() {}

    public static getInstance(): SocketService {
        if (!SocketService.instance) {
            SocketService.instance = new SocketService();
        }
        return SocketService.instance;
    }

    public initialize(server: HttpServer) {
        this.io = new Server(server, {
            cors: {
                origin: '*', // Adjust for production
                methods: ['GET', 'POST']
            }
        });

        this.io.on('connection', (socket: Socket) => {
            console.log('Client connected:', socket.id);

            socket.on('join', (room: string) => {
                socket.join(room);
                console.log(`Socket ${socket.id} joined room ${room}`);
            });

            socket.on('disconnect', () => {
                console.log('Client disconnected:', socket.id);
            });
        });

        return this.io;
    }

    public emit(room: string, event: string, data: any) {
        if (this.io) {
            this.io.to(room).emit(event, data);
        }
    }

    public emitToUser(userId: string, event: string, data: any) {
        this.emit(`user:${userId}`, event, data);
    }

    public emitToMerchant(merchantId: string, event: string, data: any) {
        this.emit(`merchant:${merchantId}`, event, data);
    }
}
