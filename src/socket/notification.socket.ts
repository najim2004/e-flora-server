import { Server as SocketIOServer, Socket } from 'socket.io';

interface Notification {
  targetUserId: string;
  type: string;
  content: string;
}

export const notificationHandler = (io: SocketIOServer, socket: Socket) => {
  socket.on('notification', (data: Notification) => {
    io.to(data.targetUserId).emit('newNotification', {
      type: data.type,
      content: data.content,
      timestamp: new Date()
    });
  });
};
