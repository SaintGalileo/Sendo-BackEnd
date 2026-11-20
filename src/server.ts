import app from './app';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { SocketService } from './modules/notifications/socket.service';
import { OrdersService } from './modules/orders/orders.service';

dotenv.config();

const PORT = process.env.PORT || 3000;
const httpServer = createServer(app);
const socketService = SocketService.getInstance();
socketService.initialize(httpServer);

const ordersService = new OrdersService();
const AUTO_SWEEP_INTERVAL_MS = 15 * 60 * 1000;
setInterval(() => {
  ordersService.autoSettleStaleDeliveries(90).catch(() => {});
}, AUTO_SWEEP_INTERVAL_MS).unref();

httpServer.listen(PORT, () => {
  console.log(`Server is now running on port ${PORT}`);
});
