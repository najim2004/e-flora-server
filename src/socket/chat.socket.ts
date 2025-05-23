import { Server as SocketIOServer, Socket } from 'socket.io';

interface ChatMessage {
  room: string;
  message: string;
  userId: string;
}

export const chatHandler = (io: SocketIOServer, socket: Socket): void => {
  // Handle chat messages
  socket.on('chatMessage', (data: ChatMessage) => {
    io.to(data.room).emit('message', {
      userId: data.userId,
      message: data.message,
      timestamp: new Date(),
    });
  });

  // Handle typing status
  socket.on('typing', (data: { room: string; userId: string }) => {
    socket.to(data.room).emit('userTyping', data.userId);
  });

  // Handle stop typing
  socket.on('stopTyping', (data: { room: string; userId: string }) => {
    socket.to(data.room).emit('userStoppedTyping', data.userId);
  });
};
