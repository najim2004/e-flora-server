import { Server as SocketIOServer, Socket } from 'socket.io';

export const roomHandler = (io: SocketIOServer, socket: Socket): void => {
  // Handle joining a room
  socket.on('joinRoom', (roomId: string) => {
    socket.join(roomId);
  });

  // Handle leaving a room
  socket.on('leaveRoom', (roomId: string) => {
    socket.leave(roomId);
  });
};
