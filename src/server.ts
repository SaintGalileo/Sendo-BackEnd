import app from './app';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { SocketService } from './modules/notifications/socket.service';

dotenv.config();

const PORT = process.env.PORT || 3000;
const httpServer = createServer(app);
const socketService = SocketService.getInstance();
socketService.initialize(httpServer);

httpServer.listen(PORT, () => {
  console.log(`Server is now running on port ${PORT}`);
});
